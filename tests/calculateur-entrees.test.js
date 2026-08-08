"use strict";

/* La table des buffs est ECRITE A LA MAIN : c'est le seul fichier de data/
   qu'aucun generateur ne reecrit. Ce test tient donc lieu de generateur - il
   refuse un code de stat invente, une valeur sans provenance, et surtout une
   phrase qui ne se trouve pas dans la description dont elle se reclame. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp, plain } = require("./helpers/load-app");

const racine = path.join(__dirname, "..");

function catalogueDe(fichier, cle){
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
  );
  return bac.window[cle];
}

const TABLE = catalogueDe("buffs-supports.js", "SEVEN_DS_BUFFS_SUPPORTS");
const WIKI = catalogueDe("wiki-competences.js", "SEVEN_DS_WIKI_COMPETENCES");

/* Les codes de stat autorises sont ceux que le depot connait deja. Se fier a
   une liste ecrite ici laisserait passer un code invente : deux codes du plan
   d'origine, AllSkill_Add et AllCategory_Add, n'existaient nulle part. */
const LIBELLES = JSON.parse(fs.readFileSync(
  path.join(racine, "7ds-stats", "libelles-stats.json"), "utf8"
));

const SUPPORTS = [
  "elizabeth", "daisy", "manny", "howzer",
  "gowther", "guila", "dreydrin", "derieri"
];

assert.deepEqual(Object.keys(TABLE).sort(), [...SUPPORTS].sort(),
  "La table doit couvrir exactement les huit supports joues");

const tousLesBuffs = SUPPORTS.flatMap(slug => TABLE[slug]);
const identifiants = new Set();

tousLesBuffs.forEach(buff => {
  assert.ok(!identifiants.has(buff.id), "identifiant en double : " + buff.id);
  identifiants.add(buff.id);

  /* Une entree porte SOIT un code de stat du heros, SOIT un effet sur la
     cible. Jamais les deux, jamais aucun : sans cette exclusion, une ligne
     mal ecrite tomberait dans la branche permissive et passerait. */
  const surLaCible = Object.prototype.hasOwnProperty.call(buff, "effet");
  assert.notEqual(surLaCible, Object.prototype.hasOwnProperty.call(buff, "stat"),
    buff.id + " : une entree porte `stat` OU `effet`, exactement un des deux");

  if(surLaCible){
    assert.ok(["defense", "defenseCritique"].includes(buff.effet),
      buff.id + " : effet inconnu sur la cible -> " + buff.effet);
    assert.equal(buff.cible, "ennemi",
      buff.id + " : un malus sur la cible doit porter cible:\"ennemi\"");
  } else {
    assert.ok(Object.prototype.hasOwnProperty.call(LIBELLES, buff.stat),
      buff.id + " : code de stat inconnu du depot -> " + buff.stat);
  }
  assert.ok(["add", "multiply"].includes(buff.operation),
    buff.id + " : operation invalide -> " + buff.operation);
  assert.ok(["flat", "ten-thousandths"].includes(buff.unite),
    buff.id + " : unite invalide -> " + buff.unite);
  assert.ok(typeof buff.valeur === "number" && buff.valeur > 0,
    buff.id + " : une valeur absente vaut null, jamais zero");
  assert.ok(buff.libelle && buff.libelle.trim(),
    buff.id + " : un buff sans libelle est illisible a l'ecran");

  /* Un buff plat vaut un pourcentage de l'ATK de son lanceur, plafonne. La
     table gardait le seul plafond, donc le taux etait perdu et la valeur
     figee : `indexeSurAtk` le rend, et `valeur` reste le repli utilise quand
     l'ATK du support est inconnue.

     Le plafond et le repli DOIVENT rester egaux. S'ils divergeaient, le repli
     cesserait d'etre le chiffre d'avant sans que rien ne le signale. */
  if(buff.unite === "flat"){
    assert.ok(buff.indexeSurAtk,
      buff.id + " : un buff plat doit porter indexeSurAtk");
    assert.ok(Number.isFinite(buff.indexeSurAtk.taux)
      && buff.indexeSurAtk.taux > 0,
      buff.id + " : indexeSurAtk.taux doit etre un taux positif");
    assert.equal(buff.indexeSurAtk.plafond, buff.valeur,
      buff.id + " : le plafond et la valeur de repli doivent rester egaux");
  }else{
    assert.ok(!Object.prototype.hasOwnProperty.call(buff, "indexeSurAtk"),
      buff.id + " : indexeSurAtk n'a de sens que sur un buff plat");
  }
});

/* La provenance doit designer une competence REELLE du support, et sa phrase
   doit etre un extrait LITTERAL de sa description francaise. C'est ce qui
   empeche une valeur inventee de s'installer discretement. */
SUPPORTS.forEach(slug => {
  TABLE[slug].forEach(buff => {
    const source = (WIKI[slug] || [])
      .find(k => k.gameId === buff.provenance.gameId);
    assert.ok(source,
      buff.id + " : gameId absent du wiki -> " + buff.provenance.gameId);
    const nue = (source.descriptionFr || "").replace(/\[#?[0-9A-Fa-f-]*\]/g, "");
    assert.ok(nue.includes(buff.provenance.phrase),
      buff.id + " : la phrase n'est pas un extrait de " + source.nomFr
        + "\n  cherche : " + buff.provenance.phrase);
  });
});

const { hooks } = loadApp();
const { bonusCategorieDesBuffs, buffsApplicables, entreesDuCalcul,
  resultatsParCompetence } = hooks;

/* Aucune base a zero : un buff `multiply` sur une base nulle ne changerait
   rien, et la sonde ci-dessous le prendrait pour un code non branche. La
   fixture doit mesurer le BRANCHEMENT, jamais la base. */
const NEUTRE = {
  atk:1000, attaqueElementaire:500, def:400, maxHp:20000,
  critRate:3000, critDamage:12000, percementDefense:500
};

/* Aucun buff ne doit etre silencieusement ignore : si son code n'est pas
   branche, il ne changerait rien et personne ne le verrait. Ce test est le
   filet qui aurait attrape AllSkill_Add.

   DEUX sorties valides, pas une. Un buff de CATEGORIE ne touche justement
   aucune entree du moteur - les seaux communs valent pour toutes les
   competences a la fois, y verser un bonus de competence normale gonflerait
   l'ultime - et le filet d'origine l'aurait rejete a tort. */
tousLesBuffs.forEach(buff => {
  const nu = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[] });
  const avec = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[buff] });
  const changeLeMoteur = Object.keys(nu).some(cle => nu[cle] !== avec[cle]);
  const changeUneCategorie =
    Object.keys(bonusCategorieDesBuffs([buff])).length > 0;
  assert.ok(changeLeMoteur || changeUneCategorie,
    buff.id + " : ce buff ne change NI une entree du moteur NI un bonus de "
      + "categorie, son code " + buff.stat + " n'est branche nulle part");
});

/* Un buff sans element vaut pour tout build ; un buff elementaire n'est
   propose qu'au build de cet element, et il est ABSENT des autres - ni grise
   ni affiche a zero. */
{
  const surVent = buffsApplicables("wind").map(b => b.id);
  const surFeu = buffsApplicables("fire").map(b => b.id);

  tousLesBuffs.filter(b => b.element === "wind").forEach(b => {
    assert.ok(surVent.includes(b.id), "buff Vent absent d'un build Vent : " + b.id);
    assert.ok(!surFeu.includes(b.id), "buff Vent propose a un build Feu : " + b.id);
  });
  tousLesBuffs.filter(b => !b.element).forEach(b => {
    assert.ok(surVent.includes(b.id) && surFeu.includes(b.id),
      "un buff sans element vaut pour tout build : " + b.id);
  });
  assert.ok(buffsApplicables("wind").every(b => b.support),
    "chaque buff propose doit dire de quel support il vient");
}

/* Un buff coche modifie l'entree attendue et UNE SEULE. */
{
  const nu = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[] });
  const avec = entreesDuCalcul({
    statsDuBuild:NEUTRE,
    buffsCoches:[{ stat:"C_Critical_Dam_Rate", operation:"add",
                   valeur:1500, unite:"ten-thousandths" }]
  });
  assert.equal(avec.critDamage, nu.critDamage + 1500);
  assert.equal(avec.atk, nu.atk, "un buff de degats crit ne touche pas l'ATK");
  assert.equal(avec.critRate, nu.critRate);
}

/* Un buff de taux critique venu d'un SOUTIEN remplit le seau allie, jamais
   celui du heros : le moteur plafonne le critique propre a 90 % et ajoute
   celui des allies apres ce plafond. Verse dans `critRate`, un buff de Daisy
   serait purement perdu sur un build deja au plafond. */
{
  const r = entreesDuCalcul({
    statsDuBuild:NEUTRE,
    buffsCoches:[{ stat:"C_Critical_Rate", operation:"add",
                   valeur:2000, unite:"ten-thousandths" }]
  });
  assert.equal(r.critRate, NEUTRE.critRate, "le critique propre n'est pas touche");
  assert.equal(r.critRateAllie, 2000);
}

/* Et les buffs de taux critique de la table cumulent dans ce seau. */
{
  const critiques = tousLesBuffs.filter(b => b.stat === "C_Critical_Rate");
  assert.ok(critiques.length >= 2,
    "la table doit porter plusieurs buffs de taux critique");
  const r = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:critiques });
  assert.equal(r.critRateAllie,
    critiques.reduce((somme, b) => somme + b.valeur, 0));
  assert.equal(r.critRate, NEUTRE.critRate);
}

/* `multiply` multiplie la valeur du heros ; `add` s'y ajoute. */
{
  const r = entreesDuCalcul({
    statsDuBuild:NEUTRE,
    buffsCoches:[{ stat:"I_AtkAdd_Rate", operation:"multiply",
                   valeur:1000, unite:"ten-thousandths" }]
  });
  assert.equal(r.atk, 1100, "+10 % de 1000");

  const p = entreesDuCalcul({
    statsDuBuild:NEUTRE,
    buffsCoches:[{ stat:"Fire_Add", operation:"add",
                   valeur:3000, unite:"flat" }]
  });
  assert.equal(p.attaqueElementaire, 3500,
    "une attaque elementaire plate alimente attaqueElementaire, pas atk");
  assert.equal(p.atk, 1000, "l'ATK de base n'est pas touchee");
}

/* Le percement de defense a son entree propre. `A_Accuracy` (« Perforation »),
   qui est une valeur PLATE et une autre statistique, n'en a toujours pas :
   la confondre avec celle-ci gonflerait tous les chiffres. */
{
  const r = entreesDuCalcul({
    statsDuBuild:NEUTRE,
    buffsCoches:[{ stat:"D_Protect_Cur_Rate", operation:"add",
                   valeur:1500, unite:"ten-thousandths" }]
  });
  assert.equal(r.percementDefense, NEUTRE.percementDefense + 1500);
  assert.equal(r.def, NEUTRE.def, "il perce la cible, il ne change pas notre DEF");

  const perforation = entreesDuCalcul({
    statsDuBuild:NEUTRE,
    buffsCoches:[{ stat:"A_Accuracy", operation:"add",
                   valeur:100, unite:"flat" }]
  });
  assert.deepEqual(perforation, entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[] }),
    "la perforation reste sans effet tant que sa mecanique n'est pas etablie");
}

/* Les malus infliges a la CIBLE ont leurs deux seaux propres, et le build ne
   les alimente jamais : ils ne viennent que des competences d'equipe. */
{
  const nu = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[] });
  assert.equal(nu.reductionDefense, 0);
  assert.equal(nu.reductionDefenseCritique, 0);

  const avec = entreesDuCalcul({
    statsDuBuild:NEUTRE,
    buffsCoches:[
      { cible:"ennemi", effet:"defense", operation:"add",
        valeur:2000, unite:"ten-thousandths" },
      { cible:"ennemi", effet:"defenseCritique", operation:"add",
        valeur:5000, unite:"ten-thousandths" }
    ]
  });
  assert.equal(avec.reductionDefense, 2000);
  assert.equal(avec.reductionDefenseCritique, 5000);
  assert.equal(avec.def, NEUTRE.def, "ces malus visent la cible, pas notre build");
}

/* Les malus de meme nature se cumulent : les trois reductions de defense de
   la table donnent 50 %. Choix documente, pas mesure. */
{
  const reductions = tousLesBuffs.filter(b => b.effet === "defense");
  assert.equal(reductions.length, 3,
    "Elisabeth, Gowther et Dreydrin reduisent la defense generale");
  const r = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:reductions });
  assert.equal(r.reductionDefense, 5000, "20 % + 20 % + 10 %");
}

/* Les bonus de degats elementaires atterrissent dans le seau du moteur. */
{
  const r = entreesDuCalcul({
    statsDuBuild:NEUTRE,
    buffsCoches:[{ stat:"Fire_Element_Rate", operation:"add",
                   valeur:3000, unite:"ten-thousandths" }]
  });
  assert.equal(r.bonusElementaire, 3000);
}

/* Une competence non chiffrable garde sa LIGNE et perd son chiffre : la
   masquer ferait croire qu'elle n'existe pas, la chiffrer a zero qu'elle ne
   fait rien. */
{
  const lignes = resultatsParCompetence({
    competences:[
      { nom:"chiffree", pourcentage:100, repartition:[100],
        composantes:[{ base:"atk", pourcentage:100 }] },
      { nom:"muette", pourcentage:null, repartition:[], composantes:[] }
    ],
    entrees:{ atk:1000, attaqueElementaire:0, def:0, maxHp:0,
              critRate:0, critDamage:0 },
    cible:{ def:5600, critResist:0, critDmgResist:0,
            resistanceElementaire:0, faiblesse:0 }
  });
  assert.equal(lignes.length, 2, "les deux lignes restent presentes");
  assert.ok(lignes[0].resultat, "la competence chiffree porte un resultat");
  assert.equal(Math.round(lignes[0].resultat.total), 500);
  assert.strictEqual(lignes[1].resultat, null, "la muette rend null, pas zero");
}

/* Les bonus de degats par CATEGORIE de competence.

   Le jeu en publie cinq — attaque normale, competence normale, speciale,
   ultime, competence de releve — et le catalogue de competences porte
   exactement les cinq categories correspondantes. Ils viennent des paliers de
   potentiel, des armes et de l'equipement.

   Ils ne peuvent PAS entrer dans les entrees communes : celles-ci valent pour
   toutes les competences a la fois, et appliquer le bonus d'ultime a une
   attaque normale serait faux. C'est ce qui les tenait hors du calcul.

   L'outil de reference ne tranche pas la question : son champ unique est un
   multiplicateur GLOBAL applique sur les cinq onglets, et son texte d'aide
   demande au joueur de saisir a la main la valeur correspondant a l'onglet
   affiche (RAPPORT-analyse-tapscreen.md, session 4). Chez lui une seule
   competence est visible a la fois, donc l'approximation passe ; notre tableau
   les montre toutes ensemble, donc elle ne passerait pas. */
{
  const cible = { def:0, critResist:0, critDmgResist:0,
                  resistanceElementaire:0, faiblesse:0 };
  const entrees = { atk:1000, attaqueElementaire:0, def:0, maxHp:0,
                    critRate:0, critDamage:0, bonusCategorie:0 };
  const coup = { pourcentage:100, repartition:[100],
                 composantes:[{ base:"atk", pourcentage:100 }] };
  const competences = [
    Object.assign({ nom:"normale", categorie:"NORMAL" }, coup),
    Object.assign({ nom:"skill", categorie:"NORMAL_SKILL" }, coup),
    Object.assign({ nom:"speciale", categorie:"ACTIVE_THIRD" }, coup),
    Object.assign({ nom:"ultime", categorie:"ULTIMATE" }, coup),
    Object.assign({ nom:"releve", categorie:"TAG_SKILL" }, coup)
  ];

  /* Sans bonus, les cinq lignes valent l'ATK : la cible n'absorbe rien. */
  const nues = resultatsParCompetence({ competences, entrees, cible });
  nues.forEach(ligne => assert.equal(
    Math.round(ligne.resultat.sansCritique), 1000, ligne.competence.nom
  ));

  /* +100 % sur la seule competence normale : UNE ligne double, les autres ne
     bougent pas d'une unite. C'est la regression que ce bloc garde. */
  const cible100 = resultatsParCompetence({
    competences, entrees, cible,
    bonusParCategorie:{ NORMAL_SKILL:10000 }
  });
  assert.deepEqual(
    cible100.map(l => Math.round(l.resultat.sansCritique)),
    [1000, 2000, 1000, 1000, 1000],
    "seule la competence normale doit doubler"
  );

  /* Les cinq categories sont cablees, aucune oubliee. */
  const toutes = resultatsParCompetence({
    competences, entrees, cible,
    bonusParCategorie:{
      NORMAL:10000, NORMAL_SKILL:10000, ACTIVE_THIRD:10000,
      ULTIMATE:10000, TAG_SKILL:10000
    }
  });
  assert.deepEqual(
    toutes.map(l => Math.round(l.resultat.sansCritique)),
    [2000, 2000, 2000, 2000, 2000]
  );

  /* Une categorie inconnue ne doit rien ajouter, et surtout rien casser. */
  const inconnue = resultatsParCompetence({
    competences:[Object.assign({ nom:"bizarre", categorie:"AUTRE" }, coup)],
    entrees, cible, bonusParCategorie:{ NORMAL:10000 }
  });
  assert.equal(Math.round(inconnue[0].resultat.sansCritique), 1000);

  /* Le bonus de categorie s'AJOUTE au seau, il ne le remplace pas : un buff
     de soutien deja verse dans bonusCategorie doit survivre. */
  const cumule = resultatsParCompetence({
    competences:[competences[1]],
    entrees:Object.assign({}, entrees, { bonusCategorie:5000 }),
    cible,
    bonusParCategorie:{ NORMAL_SKILL:10000 }
  });
  assert.equal(Math.round(cumule[0].resultat.sansCritique), 2500);
}

/* Les bonus de categorie ne peuvent pas traverser entreesDuCalcul : ses seaux
   valent pour TOUTES les competences a la fois, et y verser un bonus de
   competence normale gonflerait l'ultime. Ils sortent donc a part. */
{
  const { bonusCategorieDesBuffs } = hooks;
  assert.equal(typeof bonusCategorieDesBuffs, "function",
    "bonusCategorieDesBuffs doit etre expose par le chargeur de tests");

  assert.deepEqual(plain(bonusCategorieDesBuffs([])), {},
    "sans buff, aucune categorie ne recoit quoi que ce soit");

  assert.deepEqual(
    plain(bonusCategorieDesBuffs([
      { stat:"Normalskill_Damadd_Rate", valeur:8000 }
    ])),
    { NORMAL_SKILL:8000 },
    "un buff de categorie atterrit dans SA categorie, et nulle part ailleurs"
  );

  /* Deux buffs de la meme categorie s'additionnent : ils viennent de sources
     differentes - une tenue gravee et un soutien - et le jeu les cumule. */
  assert.deepEqual(
    plain(bonusCategorieDesBuffs([
      { stat:"Normalskill_Damadd_Rate", valeur:8000 },
      { stat:"Normalskill_Damadd_Rate", valeur:5000 }
    ])),
    { NORMAL_SKILL:13000 }
  );

  /* Un buff ordinaire n'y met rien : il a deja son seau dans le moteur. */
  assert.deepEqual(
    plain(bonusCategorieDesBuffs([{ stat:"C_Critical_Rate", valeur:2000 }])), {},
    "un buff hors categorie ne doit rien ajouter"
  );

  /* Une valeur illisible est ignoree, elle ne devient jamais NaN : un NaN dans
     le seau ferait disparaitre toute la ligne de degats. */
  assert.deepEqual(
    plain(bonusCategorieDesBuffs([
      { stat:"Ultimateskill_Damadd_Rate", valeur:"beaucoup" }
    ])), {}
  );
}

console.log(
  "calculateur-entrees.test.js OK (" + tousLesBuffs.length + " buffs sur "
    + SUPPORTS.length + " supports)"
);
