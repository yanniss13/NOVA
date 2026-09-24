"use strict";

/* Les outils de /jarvis, sans reseau : un catalogue minuscule ecrit ici, et
   un faux `requete` qui repond selon le chemin PostgREST demande. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const {
  DECLARATIONS_OUTILS_JARVIS, creerOutilsJarvis
} = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-outils.js"));

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const CATALOGUE = {
  version:1,
  personnages:{
    meliodas:{ nom:"Meliodas", rarete:"SSR", armes:[
      { type:"Sword1h", arme:"Épée longue", element:"Feu", role:"Attaquant" },
      { type:"Axe", arme:"Hache", element:"Ténèbres", role:"Briseur" },
      { type:"Book", arme:"Grimoire", element:"Feu", role:"Soutien" }
    ] },
    merlin:{ nom:"Merlin", rarete:"SSR", armes:[
      { type:"Staff", arme:"Bâton", element:"Glace", role:"Soutien" },
      { type:"Wand", arme:"Baguette", element:"Foudre", role:"Attaquant" },
      { type:"Book", arme:"Grimoire", element:"Sacré", role:"Soutien" }
    ] }
  },
  competences:{
    meliodas:[
      { type:"Axe", categorie:"NORMAL", nom:"Coup de hache", description:"Inflige 160% de l'attaque.", recharge:8 },
      { type:"Sword1h", categorie:"NORMAL", nom:"Taille", description:"Inflige 120%.", recharge:6 },
      { type:null, categorie:"PASSIVE", nom:"Démon", description:"Passif commun.", recharge:null }
    ],
    merlin:[]
  },
  potentiels:{
    meliodas:{ Axe:Array.from({ length:10 }, (_, i) => "Bonus hache " + (i + 1)),
      Sword1h:Array.from({ length:10 }, (_, i) => "Bonus épée " + (i + 1)),
      Book:Array.from({ length:10 }, (_, i) => "Bonus livre " + (i + 1)) },
    merlin:{}
  },
  equipements:[
    { nom:"Hache de guerre", fichier:"7ds-armes/Hache/Hache de guerre.webp", categorie:"arme", type:"Hache",
      passif:{ niveau:7, texte:"Augmente l'attaque de 10%." } },
    { nom:"Haut de la mélodie d'Arachnée", fichier:"7ds-armures-ssr/Haut/Haut de la mélodie d'Arachnée.webp",
      categorie:"armure", type:"Haut", ensemble:"arachnee" },
    { nom:"Bas de la mélodie d'Arachnée", fichier:"7ds-armures-ssr/Bas/Bas de la mélodie d'Arachnée.webp",
      categorie:"armure", type:"Bas", ensemble:"arachnee" },
    { nom:"Préparation totale", fichier:"7ds-armures-ssr/Armure liee/Khala — Préparation totale.webp",
      categorie:"gravee", type:"Armure gravée", heros:"merlin" }
  ],
  ensembles:{
    arachnee:{ nom:"Mélodie d'Arachnée", paliers:[
      { pieces:2, texte:"Attaque +5%" }, { pieces:4, texte:"Dégâts critiques +10%" }
    ] }
  }
};

function outils(reponses, maintenant) {
  const appels = [];
  const requete = async chemin => {
    appels.push(chemin);
    for(const [prefixe, valeur] of reponses || []){
      if(chemin.startsWith(prefixe)){
        if(valeur instanceof Error) throw valeur;
        return typeof valeur === "function" ? valeur(chemin) : valeur;
      }
    }
    throw new Error("Chemin inattendu : " + chemin);
  };
  return {
    appels,
    ...creerOutilsJarvis({
      catalogue:CATALOGUE, requete,
      maintenant:() => maintenant || new Date("2026-09-24T19:00:00Z")
    })
  };
}

async function main() {
  /* Les declarations : sept outils, noms stables, schemas au format Gemini. */
  assert.deepEqual(DECLARATIONS_OUTILS_JARVIS.map(d => d.name), [
    "lister_personnages", "fiche_personnage", "chercher_equipement",
    "qui_possede", "roster_de", "dispos", "scores_boss"
  ]);
  DECLARATIONS_OUTILS_JARVIS.forEach(declaration => {
    assert.ok(declaration.description.length > 20, declaration.name + " doit être décrit");
    if(declaration.parameters){
      assert.equal(declaration.parameters.type, "OBJECT", "Gemini attend OBJECT en majuscules");
    }
  });

  /* lister_personnages */
  const liste = await outils().executer("lister_personnages", {});
  assert.equal(liste.source, "liste des héros");
  assert.deepEqual(liste.donnees[0], {
    nom:"Meliodas", rarete:"SSR",
    armes:["Épée longue (Feu, Attaquant)", "Hache (Ténèbres, Briseur)", "Grimoire (Feu, Soutien)"]
  });

  /* fiche_personnage : nom approximatif, accents et casse ignores. */
  const fiche = await outils().executer("fiche_personnage", { nom:"MÉL" });
  assert.equal(fiche.donnees.personnage, "Meliodas");
  assert.equal(fiche.source, "fiche Meliodas");
  assert.equal(fiche.donnees.armes.length, 3);
  const hache = fiche.donnees.armes.find(a => a.arme === "Hache");
  assert.deepEqual(hache.competences.map(c => c.nom), ["Coup de hache"]);
  assert.equal(hache.potentiels[0], "P1 : Bonus hache 1");
  assert.equal(hache.potentiels[9], "P10 : Bonus hache 10");
  assert.deepEqual(fiche.donnees.competencesCommunes.map(c => c.nom), ["Démon"]);

  /* ... filtree sur une arme */
  const ficheHache = await outils().executer("fiche_personnage", { nom:"meliodas", arme:"hache" });
  assert.deepEqual(ficheHache.donnees.armes.map(a => a.arme), ["Hache"]);
  const ficheArmeInconnue = await outils().executer("fiche_personnage", { nom:"meliodas", arme:"lance" });
  assert.equal(ficheArmeInconnue.donnees.armeInconnue, "lance");
  assert.deepEqual(ficheArmeInconnue.donnees.armes, ["Épée longue", "Hache", "Grimoire"]);

  /* ... introuvable : des propositions plutot qu'un refus sec */
  const inconnu = await outils().executer("fiche_personnage", { nom:"Merlinette" });
  assert.equal(inconnu.donnees.introuvable, "Merlinette");
  assert.ok(inconnu.donnees.proches.includes("Merlin"));

  /* chercher_equipement : par nom de piece ou par nom d'ensemble */
  const parEnsemble = await outils().executer("chercher_equipement", { texte:"arachnee" });
  assert.equal(parEnsemble.donnees.total, 2);
  assert.deepEqual(parEnsemble.donnees.objets[0].ensemble, {
    nom:"Mélodie d'Arachnée", paliers:["2 pièces : Attaque +5%", "4 pièces : Dégâts critiques +10%"]
  });
  const arme = await outils().executer("chercher_equipement", { texte:"hache de guerre" });
  assert.equal(arme.donnees.objets[0].passif, "Niv. 7 : Augmente l'attaque de 10%.");
  assert.equal(arme.source, "recherche « hache de guerre »");
  const gravee = await outils().executer("chercher_equipement", { texte:"préparation" });
  assert.equal(gravee.donnees.objets[0].heros, "Merlin");
  assert.equal(gravee.donnees.objets[0].nom, "Préparation totale",
    "le nom vient du catalogue, jamais du chemin prefixe « Khala — »");
  const tropCourt = await outils().executer("chercher_equipement", { texte:"a" });
  assert.equal(tropCourt.donnees.erreur, "recherche trop courte");

  /* Un outil inconnu ne fait rien tomber. */
  const fantome = await outils().executer("effacer_tout", {});
  assert.deepEqual(fantome, { donnees:{ erreur:"outil inconnu" }, source:null });

  /* Aucun UUID ne sort d'un outil du jeu. */
  [liste, fiche, parEnsemble, arme].forEach(resultat =>
    assert.doesNotMatch(JSON.stringify(resultat), UUID));

  console.log("OK discord-jarvis-outils");
}

module.exports = { CATALOGUE, outils, UUID };

if(require.main === module){
  main().catch(erreur => { console.error(erreur); process.exit(1); });
}
