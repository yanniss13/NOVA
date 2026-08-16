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
const { EFFETS_SUR_LA_CIBLE } = require("./helpers/effets-cible");

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

/* LES PERSONNAGES DE LA TABLE, et non "les supports".

   Escanor porte son malus de defense avec une Epee a deux mains de role
   Attaquant, Meliodas n'est support de rien, et King debuffe avec un
   Grimoire de role Gardien. Ce qui rassemble ces lignes n'est pas un role -
   c'est un effet sur la cible, ou un bonus rendu a l'equipe.

   La liste est en dur pour qu'un ajout de personnage soit un GESTE : sans
   elle, une clef mal orthographiee - "gilthunder" au lieu de "gil-thunder"
   - creerait un quinzieme personnage fantome que rien ne signalerait. */
const PERSONNAGES = [
  "elizabeth", "daisy", "manny", "howzer",
  "gowther", "guila", "dreydrin", "derieri",
  /* Entres avec le recensement "Affaiblissement de la cible" : ils ne
     donnent rien a l'equipe, ils retirent quelque chose au boss. */
  "drake", "escanor", "gil-thunder", "king", "klotho", "slader", "tioreh"
];

assert.deepEqual(Object.keys(TABLE).sort(), [...PERSONNAGES].sort(),
  "La table doit couvrir exactement les personnages declares ici");

const tousLesBuffs = PERSONNAGES.flatMap(slug => TABLE[slug]);
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
    assert.ok(EFFETS_SUR_LA_CIBLE.includes(buff.effet),
      buff.id + " : effet inconnu sur la cible -> " + buff.effet);
    assert.equal(buff.cible, "ennemi",
      buff.id + " : un malus sur la cible doit porter cible:\"ennemi\"");
  } else {
    assert.ok(Object.prototype.hasOwnProperty.call(LIBELLES, buff.stat),
      buff.id + " : code de stat inconnu du depot -> " + buff.stat);
  }
  /* LE DRAPEAU ET SON EFFET VONT ENSEMBLE, dans les deux sens.

     Sans le premier sens, une ligne de resistance elementaire oubliee de
     drapeau atteindrait le calculateur. Sans le second, un drapeau pose par
     erreur sur un malus reel le ferait disparaitre des cases a cocher, en
     silence et sans qu'aucun chiffre ne bouge - le pire des deux. */
  const consignee = Object.prototype.hasOwnProperty.call(buff, "horsCalcul");
  if(consignee){
    assert.equal(buff.horsCalcul, true,
      buff.id + " : `horsCalcul` ne s'ecrit qu'a true, ou pas du tout");
  }
  assert.equal(consignee, buff.effet === "resistanceElementaire",
    buff.id + " : `horsCalcul` et l'effet `resistanceElementaire` vont "
      + "ensemble, ou pas du tout");
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

/* Le nombre qui suit une phrase, apres avoir verifie qu'elle apparait
   EXACTEMENT une fois - sinon on ne saurait pas de quel nombre on parle. */
function nombreApres(texte, phrase, quoi){
  const morceaux = texte.split(phrase);
  assert.equal(morceaux.length, 2,
    quoi + " : la phrase doit apparaitre EXACTEMENT une fois, trouvee "
      + (morceaux.length - 1) + " fois\n  cherche : " + phrase);
  const trouve = /^(-?\d+(?:[.,]\d+)?)\s*%?/.exec(morceaux[1]);
  assert.ok(trouve && trouve[1],
    quoi + " : aucun nombre ne suit la phrase\n  cherche : " + phrase);
  return Number(trouve[1].replace(",", "."));
}

/* La provenance doit designer une competence REELLE du support, et sa phrase
   doit etre un extrait LITTERAL de sa description francaise. C'est ce qui
   empeche une valeur inventee de s'installer discretement. */
PERSONNAGES.forEach(slug => {
  TABLE[slug].forEach(buff => {
    const source = (WIKI[slug] || [])
      .find(k => k.gameId === buff.provenance.gameId);
    assert.ok(source,
      buff.id + " : gameId absent du wiki -> " + buff.provenance.gameId);
    const nue = (source.descriptionFr || "").replace(/\[#?[0-9A-Fa-f-]*\]/g, "");
    assert.ok(nue.includes(buff.provenance.phrase),
      buff.id + " : la phrase n'est pas un extrait de " + source.nomFr
        + "\n  cherche : " + buff.provenance.phrase);

    /* LES CUMULS, et c'est le seul endroit de ce fichier ou les nombres sont
       relus un a un. Une valeur a cumuls est un PRODUIT - « 2 % par cumul,
       (Max : 10 fois) » vaut 2000 - et ce produit etait jusqu'ici pose de
       tete : le texte publiait 2 et 10, la table stockait 2000, et une erreur
       de facteur dix serait passee sans bruit.

       Deux phrases, deux nombres, et le produit compare. Le transcripteur ne
       peut plus se tromper en silence. */
    const aDesCumuls = Object.prototype.hasOwnProperty.call(buff, "cumuls");
    assert.equal(aDesCumuls,
      Object.prototype.hasOwnProperty.call(buff, "parCumul"),
      buff.id + " : `cumuls` et `parCumul` vont ensemble, ou pas du tout");
    assert.equal(aDesCumuls,
      Object.prototype.hasOwnProperty.call(buff.provenance, "phraseCumuls"),
      buff.id + " : une valeur a cumuls doit citer la phrase de son compte");
    if(!aDesCumuls) return;

    assert.ok(Number.isInteger(buff.cumuls) && buff.cumuls > 1,
      buff.id + " : un compte de cumuls est un entier superieur a un");
    assert.equal(
      nombreApres(nue, buff.provenance.phrase, buff.id + " (par cumul)"),
      buff.parCumul / 100,
      buff.id + " : le texte annonce une autre valeur par cumul que la table");
    assert.equal(
      nombreApres(nue, buff.provenance.phraseCumuls, buff.id + " (cumuls)"),
      buff.cumuls,
      buff.id + " : le texte annonce un autre nombre de cumuls que la table");
    assert.equal(buff.parCumul * buff.cumuls, buff.valeur,
      buff.id + " : la valeur doit etre le PRODUIT du pas par le nombre de "
        + "cumuls, soit " + (buff.parCumul * buff.cumuls) + ", recu "
        + buff.valeur);
  });
});

const { hooks } = loadApp();
const { bonusCategorieDesBuffs, buffsApplicables, entreesDuCalcul,
  resultatsParCompetence, resultatsParCompetenceCompares } = hooks;

/* Une ligne comparee garde le resultat de reference et isole son ecart : un
   calcul absent ne devient jamais un zero ni un pourcentage invente. */
{
  assert.equal(typeof resultatsParCompetenceCompares, "function");
  const lignes = resultatsParCompetenceCompares([
    { competence:{ gameId:"a" },
      resultat:{ sansCritique:100, avecCritique:200, total:150 } },
    { competence:{ gameId:"b" }, resultat:null },
    { competence:{ gameId:"c" },
      resultat:{ sansCritique:0, avecCritique:0, total:0 } }
  ], [
    { competence:{ gameId:"a" },
      resultat:{ sansCritique:125, avecCritique:260, total:180 } },
    { competence:{ gameId:"b" }, resultat:null },
    { competence:{ gameId:"c" },
      resultat:{ sansCritique:20, avecCritique:20, total:20 } }
  ]);
  assert.deepEqual(plain(lignes[0].ecarts.total), { absolu:30, relatif:2000 });
  assert.deepEqual(plain(lignes[0].ecarts.avecCritique), { absolu:60, relatif:3000 });
  assert.equal(lignes[1].ecarts, null,
    "une competence non chiffree ne doit pas recevoir de delta");
  assert.deepEqual(plain(lignes[2].ecarts.total), { absolu:20, relatif:null },
    "une reference nulle garde son ecart absolu sans division par zero");
}

/* Aucune base a zero : un buff `multiply` sur une base nulle ne changerait
   rien, et la sonde ci-dessous le prendrait pour un code non branche. La
   fixture doit mesurer le BRANCHEMENT, jamais la base. */
const NEUTRE = {
  atk:1000, attaqueElementaire:500, def:400, maxHp:20000,
  critRate:3000, critDamage:12000, percementDefense:500
};

tousLesBuffs.forEach(buff => {
  const nu = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[] });
  const avec = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[buff] });
  const changeLeMoteur = Object.keys(nu).some(cle => nu[cle] !== avec[cle]);
  const changeUneCategorie =
    Object.keys(bonusCategorieDesBuffs([buff])).length > 0;
  /* UNE LIGNE CONSIGNEE NE CHANGE RIEN, et c'est sa definition. Le filet
     s'inverse pour elle : au lieu d'exiger qu'elle branche quelque chose, on
     exige qu'elle ne branche RIEN. Une ligne hors calcul qui deplacerait une
     entree du moteur serait un mensonge silencieux. */
  if(buff.horsCalcul){
    assert.ok(!changeLeMoteur && !changeUneCategorie,
      buff.id + " : une ligne hors calcul ne doit toucher AUCUNE entree du "
        + "moteur, or celle-ci en change une");
    return;
  }
  assert.ok(changeLeMoteur || changeUneCategorie,
    buff.id + " : ce buff ne change NI une entree du moteur NI un bonus de "
      + "categorie, son code " + buff.stat + " n'est branche nulle part");
});

/* LA GARDE QUI COMPTE LE PLUS DE TOUT CE CHANTIER.

   Une ligne consignee vit dans le recensement de l'Analyse, pour composer un
   groupe. Elle ne doit JAMAIS apparaitre en case a cocher du calculateur : le
   membre la cocherait, verrait son total ne pas bouger, et croirait pourtant
   son effet compte. Le silence est ici pire que l'absence. */
{
  const consignees = tousLesBuffs.filter(buff => buff.horsCalcul);
  assert.ok(consignees.length > 0,
    "la table doit porter au moins une ligne consignee, sinon cette garde ne "
      + "verifie rien");
  ["", "fire", "ice", "wind", "earth", "holy", "dark", "thunder", "default"]
    .forEach(element => {
      const proposes = new Set(buffsApplicables(element).map(buff => buff.id));
      consignees.forEach(ligne => assert.ok(!proposes.has(ligne.id),
        ligne.id + " : ligne hors calcul proposee au calculateur pour l'element « "
          + element + " »"));
    });
}

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

/* Un buff temporaire d'ensemble vise le heros lui-meme. Il doit donc rejoindre
   son critique propre, qui suit le plafond normal, plutot que le seau ajoute
   apres plafond reserve aux soutiens. */
{
  const r = entreesDuCalcul({
    statsDuBuild:{ critRate:8500, percementDefense:0 },
    buffsCoches:[
      { stat:"C_Critical_Rate", valeur:1200, porteur:"hero" },
      { stat:"D_Protect_Cur_Rate", valeur:1200, porteur:"hero" }
    ]
  });
  assert.equal(r.critRate, 9700);
  assert.equal(r.critRateAllie, 0);
  assert.equal(r.percementDefense, 1200);
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

/* Les malus de meme nature se cumulent : les sept reductions de defense de
   la table donnent 119 %. Choix documente, pas mesure. */
{
  const reductions = tousLesBuffs.filter(b => b.effet === "defense");
  assert.equal(reductions.length, 7,
    "Elisabeth, Gowther, Dreydrin, Escanor, Guila et Tioreh réduisent la défense générale");
  const r = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:reductions });
  assert.equal(r.reductionDefense, 11900, "10 % + 20 % + 15 % + 20 % + 24 % + 15 % + 15 %");
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

/* LA VULNERABILITE GLOBALE d'Extinction : +100 % de degats subis DOUBLE la
   ligne, sur toutes les categories a la fois. C'est le plus gros buff de la
   table, et il est reste absent tout un lot faute d'un seau pour le porter -
   ce test fixe ce qu'il fait, pour que personne n'ait a le redecouvrir. */
{
  const { degatsAttendus } = hooks;
  const extinction = TABLE.gowther
    .find(b => b.id === "gowther-extinction-degats-subis");
  assert.ok(extinction, "le buff d'Extinction doit exister");
  assert.equal(extinction.effet, "vulnerabiliteGlobale");

  const cible = { def:0, critResist:0, critDmgResist:0,
    resistanceElementaire:0, faiblesse:0, resistancePercement:0 };
  const stats = { atk:1000, critRate:0, critDamage:0 };
  const contre = coches => degatsAttendus({
    stats:entreesDuCalcul({ statsDuBuild:stats, buffsCoches:coches }),
    competence:{ categorie:"ULTIMATE", pourcentage:250 },
    cible
  }).total;
  assert.equal(Math.round(contre([])), 2500, "250 % de 1000 d'ATK");
  assert.equal(Math.round(contre([extinction])), 5000,
    "+100 % de degats subis doit exactement doubler la ligne");

  /* Et elle ne se restreint a AUCUNE categorie, contrairement a sa voisine :
     une attaque normale la recoit autant qu'un ultime. */
  assert.deepEqual(plain(bonusCategorieDesBuffs([extinction])), {},
    "une vulnerabilite globale ne doit pas se poser sur une categorie");
}

/* Le bonus de categorie d'un PALIER DE POTENTIEL suit son propre chemin :
   `bonusPotentielParCategorie` doit arriver jusqu'au moteur SANS etre verse
   dans le seau de l'equipement, qu'il multiplie au lieu de le grossir.

   Mesure en jeu (mannequin, Merlin p10 Baguette, Jugement foudroyant) :
   l'ecran de stats affiche 25,05 % pour la competence normale et non 40,05 %,
   et seul le produit des deux retrouve le coup releve. Ce test tient la
   plomberie ; la formule elle-meme est verifiee dans degats-calcul.test.js. */
{
  const competence = {
    categorie:"NORMAL_SKILL", pourcentage:100, repartition:[100]
  };
  const cible = {
    def:0, critResist:0, critDmgResist:0, resistanceElementaire:0, faiblesse:0
  };
  const entrees = {
    atk:10000, attaqueElementaire:0, critRate:0, critDamage:0,
    bonusCategorie:0, bonusElementaire:0, bonusGlobal:0
  };
  const total = extra => resultatsParCompetence(Object.assign({
    competences:[competence], entrees,
    bonusParCategorie:{ NORMAL_SKILL:2505 }, cible
  }, extra))[0].resultat.total;

  assert.equal(Math.round(total({})), 12505,
    "l'equipement seul : 10 000 x 1,2505");
  assert.equal(
    Math.round(total({ bonusPotentielParCategorie:{ NORMAL_SKILL:1500 } })),
    14381,
    "avec le palier : 10 000 x 1,2505 x 1,15, et non x 1,4005 = 14 005"
  );
  /* Et il ne deborde pas sur les autres categories. */
  assert.equal(
    Math.round(total({ bonusPotentielParCategorie:{ ULTIMATE:1500 } })), 12505,
    "un palier d'ultime ne doit pas toucher une competence normale"
  );
}

/* LES DEUX STATISTIQUES ELEMENTAIRES DU BUILD.

   Elles existaient dans le catalogue - 94 objets portent `X_Rate`, 94 portent
   `X_Element_Rate` - et rien ne les lisait. Le calculateur ne remontait que
   `X_Add`, donc un membre qui roulait une stat elementaire ne voyait pas son
   chiffre bouger. */
{
  const { statsElementairesDuBuild, entreesDuCalcul,
    degatsAttendus } = loadApp().hooks;
  assert.equal(typeof statsElementairesDuBuild, "function",
    "statsElementairesDuBuild n'est pas exposee par le chargeur de tests");

  /* Un lecteur de statistiques factice qui NOTE ce qu'on lui demande : c'est
     ainsi qu'un code de stat mal orthographie se fait prendre. Un `lire()`
     rend zero pour un code inconnu, donc une faute de frappe serait
     silencieuse - elle ne ferait que rabaisser le chiffre. */
  const lecteurEspion = valeurs => {
    const demandes = [];
    const lire = code => {
      demandes.push(code);
      return Object.prototype.hasOwnProperty.call(valeurs, code)
        ? valeurs[code] : 0;
    };
    return { lire, demandes };
  };

  {
    /* Verifies contre `statLabels` du catalogue genere, et non contre
       libelles-stats.json comme le reste de ce fichier : c'est statLabels que
       l'application elle-meme interroge, par buildStatMetadata(). L'ecart
       n'est pas theorique - `AllElement_Rate` figure dans le catalogue, et un
       objet le porte, mais libelles-stats.json l'ignore. */
    const STAT_LABELS = catalogueDe("stats-build.js", "SEVEN_DS_BUILD_STATS")
      .statLabels;
    const espion = lecteurEspion({});
    statsElementairesDuBuild(espion.lire, "thunder");
    espion.demandes.forEach(code => assert.ok(STAT_LABELS[code],
      "code de stat inconnu du catalogue : " + code));
    assert.deepEqual([...espion.demandes].sort(), [
      "AllElement_Add", "AllElement_Rate",
      "Thunder_Add", "Thunder_Element_Rate", "Thunder_Rate"
    ], "les quatre codes de l'element, plus les deux « tous elements »");
  }

  /* Le taux de l'element majore SON plat, jamais celui qui vaut pour tous.
     Le taux « tous elements » majore les deux. Les deux taux s'additionnent
     avant de multiplier. */
  {
    const sortie = statsElementairesDuBuild(lecteurEspion({
      Thunder_Add:1000, Thunder_Rate:5000,
      AllElement_Add:200, AllElement_Rate:1000,
      Thunder_Element_Rate:1244
    }).lire, "thunder");
    assert.equal(sortie.attaqueElementaire, 1000 * 1.6 + 200 * 1.1,
      "1 000 x (1 + 0,50 + 0,10) + 200 x (1 + 0,10)");
    assert.equal(sortie.bonusElementaire, 1244);
  }

  /* Sans element - une arme physique dont le slot n'en porte aucun - seules
     les deux lignes « tous elements » subsistent. Rien ne doit exploser. */
  {
    const sortie = statsElementairesDuBuild(lecteurEspion({
      AllElement_Add:300, Thunder_Add:9999
    }).lire, null);
    assert.equal(sortie.attaqueElementaire, 300);
    assert.equal(sortie.bonusElementaire, 0);
  }

  /* Le seau elementaire du BUILD amorce l'entree, et les buffs de soutien
     s'ajoutent par-dessus. Avant, le build etait ignore et seul un
     coequipier pouvait remplir ce seau. */
  {
    const entrees = entreesDuCalcul({
      statsDuBuild:{ atk:1000, bonusElementaire:1244 },
      buffsCoches:[{ stat:"Thunder_Element_Rate", valeur:1000 }]
    });
    assert.equal(entrees.bonusElementaire, 2244,
      "1 244 du build + 1 000 du soutien");
  }

  /* LE SEAU GLOBAL, que le build n'alimentait pas non plus.

     `I_All_DamAdd_Rate` - « Augmentation de tous les degats » - existe dans le
     catalogue : l'ensemble « Au bord du neant » le porte a +7,5 %, des trois
     pieces. Rien ne le lisait, donc ces 7,5 % disparaissaient sans un mot.
     Meme famille d'oubli que les deux statistiques elementaires. */
  {
    const CATALOGUE = catalogueDe("stats-build.js", "SEVEN_DS_BUILD_STATS");
    assert.ok(CATALOGUE.statLabels.I_All_DamAdd_Rate,
      "le code doit exister dans le catalogue interroge par l'application.");
    const porteurs = Object.entries(CATALOGUE.gearSets).filter(([, set]) =>
      [].concat(set.twoStats || [], set.fourStats || [], set.sevenStats || [])
        .some(ligne => ligne.stat === "I_All_DamAdd_Rate"));
    assert.ok(porteurs.length,
      "au moins un ensemble doit porter ce code, sinon ce branchement est mort.");

    const entrees = entreesDuCalcul({
      statsDuBuild:{ atk:1000, bonusGlobal:750 },
      /* Une vulnerabilite cochee s'ajoute PAR-DESSUS le bonus du build : le
         seau vaut pour toutes les competences, quelle que soit l'origine. */
      buffsCoches:[{ effet:"vulnerabiliteGlobale", valeur:5000 }]
    });
    assert.equal(entrees.bonusGlobal, 5750,
      "750 du build + 5 000 de la vulnerabilite");
  }

  /* LA MESURE. Mannequin, Merlin p10 Baguette, Jugement foudroyant (159 %,
     NORMAL_SKILL), releve juste apres un rerolle d'enchantement.

       Attaque 4 813 + Attaque de l'equipement 10 374, Augmentation de
       l'attaque 73,16 % ; Attaque de Foudre 1 409 ; Augmentation de l'attaque
       de Foudre 43,76 % ; Augmentation des degats de Foudre 12,44 % ;
       competence normale 23,81 % ; palier 4 +15 %.

     Le releve vaut 70 563. Il tient l'ensemble de la chaine d'un bout a
     l'autre : les quatre codes elementaires, le seau additif partage avec le
     bonus de categorie, et le facteur multiplicatif du palier. */
  {
    const elementaires = statsElementairesDuBuild(lecteurEspion({
      Thunder_Add:1409, Thunder_Rate:4376, Thunder_Element_Rate:1244
    }).lire, "thunder");
    assert.ok(Math.abs(elementaires.attaqueElementaire - 2025.58) < 0.01,
      "1 409 x 1,4376 = 2 025,6 d'attaque de Foudre, taux compris");

    const entrees = entreesDuCalcul({
      statsDuBuild:{
        atk:(4813 + 10374) * 1.7316,
        attaqueElementaire:elementaires.attaqueElementaire,
        bonusElementaire:elementaires.bonusElementaire,
        critRate:0, critDamage:0
      },
      buffsCoches:[]
    });
    const resultat = degatsAttendus({
      stats:Object.assign({}, entrees, {
        bonusCategorie:2381, bonusCategoriePotentiel:1500
      }),
      competence:{ pourcentage:159, repartition:[] },
      cible:{
        def:0, critResist:0, critDmgResist:0,
        resistanceElementaire:0, faiblesse:0, resistancePercement:0
      }
    });
    const ecart = Math.abs(resultat.sansCritique - 70563) / 70563;
    assert.ok(ecart < 1e-4,
      "Merlin p10, Jugement foudroyant : releve en jeu 70 563, calcule "
        + resultat.sansCritique.toFixed(1) + ", ecart "
        + (ecart * 100).toFixed(4) + " %");
  }
}

console.log(
  "calculateur-entrees.test.js OK (" + tousLesBuffs.length + " buffs sur "
    + PERSONNAGES.length + " personnages)"
);
