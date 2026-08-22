"use strict";

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { puissanceSection, statsDeCycleHistorique } = hooks;

assert.strictEqual(
  typeof puissanceSection,
  "function",
  "la fiche doit isoler le rendu du classement de puissance"
);

function fakeText(node){
  if(node === null || node === undefined) return "";
  if(typeof node === "string") return node;
  return String(node.textContent || "")
    + (Array.isArray(node.children) ? node.children.map(fakeText).join("") : "");
}

const bloc = puissanceSection([
  {
    arme:"Baguette",
    cycle:160900,
    dps:8432.4,
    nonInclus:1,
    ouverture:["Champ électromagnétique", "Jugement divin"],
    priorites:[
      "Champ électromagnétique",
      "Jugement divin dès que disponible"
    ],
    rotation:[{ temps:0, nom:"Champ électromagnétique" }],
    hypotheses:[
      "Ressources illimitées",
      "Animations non mesurées",
      "attaques-normales-remplissage"
    ]
  },
  {
    arme:"Livre",
    cycle:170000,
    dps:7020.1,
    nonInclus:2,
    ouverture:["Graine de givre"],
    priorites:[],
    rotation:[],
    hypotheses:[],
    exclusions:[{ raison:"releve-hors-simulation-equipe" }]
  },
  {
    arme:"Bâton",
    cycle:805,
    dps:null,
    nonInclus:1,
    exclusions:[{ raison:"categorie-ou-recharge-non-modelisee" }],
    ouverture:[],
    priorites:[],
    rotation:[],
    hypotheses:[]
  }
]);
const texte = fakeText(bloc);

assert.match(texte, /DPS des compétences sur 60 s/);
assert.match(texte, /8.?432\/s/);
assert.match(texte, /Dégâts d'un cycle/);
assert.match(texte, /Ouverture/);
assert.match(texte, /Rotation simulée selon les priorités connues/);
assert.doesNotMatch(texte, /Rotation optimale selon les données connues/);
assert.match(
  texte,
  /Attaques normales utilisées uniquement entre les compétences à recharge/
);
assert.match(texte, /Non inclus dans le calcul/);
assert.match(texte, /DPS des compétences sur 60 s : Non disponible/);
assert.doesNotMatch(texte, /Bâton[^]*0\/s/);

const lignes = bloc.children.filter(child =>
  child.className.includes("hd-puissance-ligne")
);
assert.match(
  fakeText(lignes[0]),
  /Baguette/,
  "le DPS prime sur un cycle brut pourtant superieur"
);

const annonce = bloc.children.find(child =>
  child.className.includes("hd-puissance-non-inclus")
);
assert.ok(annonce, "le bloc doit annoncer les effets non chiffres");
assert.match(fakeText(annonce), /4 effets non chiffrés/);

const ligneSansHypotheseNormale = lignes.find(ligne =>
  fakeText(ligne).includes("Livre")
);
assert.ok(ligneSansHypotheseNormale, "la ligne Livre doit être rendue");
assert.doesNotMatch(
  fakeText(ligneSansHypotheseNormale),
  /Attaques normales non chiffrées/,
  "un build sans cette hypothèse ne doit pas l'inventer dans son détail"
);
assert.match(
  fakeText(ligneSansHypotheseNormale),
  /Compétence de relève hors simulation d’équipe/
);

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(statsDeCycleHistorique({ totals:[
    { stat:"B_Atk", value:1000 },
    { stat:"C_Critical_Rate", value:2500 },
    { stat:"C_Critical_Dam_Rate", value:5000 },
    { stat:"Thunder_Add", value:9999 },
    { stat:"AllElement_Rate", value:9999 }
  ] }))),
  { atk:1000, critRate:2500, critDamage:5000, bonusType:0 },
  "le cycle historique ne doit pas absorber les nouveaux bonus du DPS"
);

assert.strictEqual(
  puissanceSection([{ arme:"Livre", cycle:140700, dps:7020, nonInclus:1 }]),
  null
);


/* La reserve sur les animations se dit avec un compte : une mesure manquante
   vaut zero dans la simulation, donc elle gonfle le DPS affiche. Le membre
   qui a chronometre doit voir ou en est sa contribution. */
{
  const avecCompte = puissanceSection([
    {
      arme:"Baguette", cycle:1000, dps:100, nonInclus:0,
      ouverture:[], priorites:[], rotation:[],
      hypotheses:["animations-non-mesurees"],
      animations:{ mesurees:2, total:3 }
    },
    {
      arme:"Livre", cycle:900, dps:90, nonInclus:0,
      ouverture:[], priorites:[], rotation:[],
      hypotheses:["animations-non-mesurees"],
      animations:{ mesurees:0, total:0 }
    }
  ]);
  const lu = fakeText(avecCompte);
  assert.match(lu, /Animations mesurées : 2 \/ 3/);
  assert.match(
    lu,
    /Animations non mesurées/,
    "sans competence simulee, le libelle nu reste le seul honnete"
  );
}

console.log("fiche-heros.test.js OK");
