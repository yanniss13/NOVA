"use strict";

/* La table des degats supplementaires est MAINTENUE A LA MAIN. Ce test tient
   lieu de generateur : la phrase citee doit apparaitre exactement une fois
   dans le texte du palier, et le nombre qui la suit doit valoir ce que la
   table stocke. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp, plain } = require("./helpers/load-app");
const { CATEGORIES_DE_COMPETENCE } = require("./helpers/effets-cible");

const racine = path.join(__dirname, "..");

function catalogueDe(fichier, cle){
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
  );
  return bac.window[cle];
}

const TABLE = catalogueDe("degats-supplementaires.js",
  "SEVEN_DS_DEGATS_SUPPLEMENTAIRES");
const SOURCE = catalogueDe("potentiels.js", "SEVEN_DS_POTENTIELS");
const COMPETENCES = catalogueDe("competences.js", "SEVEN_DS_COMPETENCES");
/* La repartition par coup n'existe QUE dans le catalogue du wiki : celui du
   comparateur ne garde que le total. Un coup recopie s'y verifie donc. */
const WIKI = catalogueDe("wiki-competences.js", "SEVEN_DS_WIKI_COMPETENCES");

/* Le coefficient du n-ieme coup d'une competence, tel que le jeu le publie :
   « 2e coup : 315% ». Rendre null plutot que zero - un coup absent doit faire
   echouer le test, pas produire un supplement muet. */
function coupPublie(gameId, rang){
  const fiche = Object.values(WIKI)
    .flat()
    .find(k => k && k.gameId === gameId);
  if(!fiche) return null;
  const texte = dep(fiche.descriptionFr);
  const etiquette = rang === 1 ? "1er coup" : rang + "e coup";
  const trouve = new RegExp(etiquette + "\\s*:\\s*(\\d+(?:[.,]\\d+)?)\\s*%")
    .exec(texte);
  return trouve ? Number(trouve[1].replace(",", ".")) : null;
}

const dep = texte => (texte || "").replace(/\[#?[0-9A-Fa-f-]*\]/g, "");
const vus = new Set();
let comptees = 0;

function suitLaPhrase(texte, phrase, quoi){
  const morceaux = texte.split(phrase);
  assert.equal(morceaux.length, 2,
    quoi + " : la phrase doit apparaitre EXACTEMENT une fois, trouvee "
      + (morceaux.length - 1) + " fois\n  cherche : " + phrase);
  const trouve = /^(-?\d+(?:[.,]\d+)?)\s*%?/.exec(morceaux[1]);
  assert.ok(trouve && trouve[1],
    quoi + " : aucun nombre ne suit la phrase\n  cherche : " + phrase);
  return Number(trouve[1].replace(",", "."));
}

Object.keys(TABLE).forEach(perso => {
  const branches = SOURCE[perso];
  assert.ok(branches, "personnage inconnu du catalogue de potentiels : " + perso);

  Object.keys(TABLE[perso]).forEach(arme => {
    const paliers = branches[arme];
    assert.ok(Array.isArray(paliers),
      perso + " : arme inconnue de ses potentiels -> " + arme);

    Object.keys(TABLE[perso][arme]).forEach(palier => {
      const rang = Number(palier);
      assert.ok(Number.isInteger(rang) && rang >= 1 && rang <= paliers.length,
        perso + "/" + arme + " : palier hors bornes -> " + palier);
      const texte = dep(paliers[rang - 1]);

      TABLE[perso][arme][palier].forEach(ligne => {
        comptees++;
        const quoi = ligne.id;
        assert.ok(!vus.has(quoi), "identifiant en double : " + quoi);
        vus.add(quoi);

        assert.ok(CATEGORIES_DE_COMPETENCE.includes(ligne.categorie),
          quoi + " : categorie inconnue -> " + ligne.categorie);
        assert.ok(ligne.libelle && ligne.libelle.trim(),
          quoi + " : une ligne sans libelle est illisible a l'ecran");
        assert.ok(typeof ligne.pourcentage === "number" && ligne.pourcentage > 0,
          quoi + " : un pourcentage absent s'omet, il ne vaut jamais zero");
        if(Object.prototype.hasOwnProperty.call(ligne, "condition")){
          assert.ok(ligne.condition && ligne.condition.trim(),
            quoi + " : une condition vide vaut mieux absente");
        }

        /* LA GARDE. Trois formes, une seule a la fois. Le nombre qui suit la
           phrase est le PAS pour une repetition, le COMPTE DE COUPS pour un
           coup recopie, le total sinon. */
        const aDesRepetitions =
          Object.prototype.hasOwnProperty.call(ligne, "repetitions");
        assert.equal(aDesRepetitions,
          Object.prototype.hasOwnProperty.call(ligne, "pas"),
          quoi + " : `repetitions` et `pas` vont ensemble, ou pas du tout");
        const aUnCoupRecopie =
          Object.prototype.hasOwnProperty.call(ligne, "coups");
        assert.equal(aUnCoupRecopie,
          Object.prototype.hasOwnProperty.call(ligne, "frappeCopiee"),
          quoi + " : `coups` et `frappeCopiee` vont ensemble, ou pas du tout");
        assert.ok(!(aDesRepetitions && aUnCoupRecopie),
          quoi + " : une repetition et un coup recopie s'excluent - le nombre "
            + "qui suit la phrase ne peut pas etre les deux a la fois");
        assert.equal(
          suitLaPhrase(texte, ligne.provenance.phrase, quoi),
          aDesRepetitions ? ligne.pas
            : aUnCoupRecopie ? ligne.coups : ligne.pourcentage,
          quoi + " : le texte du palier " + palier + " annonce un autre nombre "
            + "que la table");

        /* Un total qui se CALCULE se verifie : « 40 % de l'attaque 5 fois »
           vaut 200 %, et le 5 doit venir du texte, pas d'une tete. */
        if(aDesRepetitions){
          assert.ok(ligne.provenance.phraseRepetitions,
            quoi + " : une repetition doit citer la phrase de son compte");
          assert.equal(
            suitLaPhrase(texte, ligne.provenance.phraseRepetitions,
              quoi + " (repetitions)"),
            ligne.repetitions,
            quoi + " : le texte annonce un autre nombre de repetitions");
          assert.equal(ligne.pas * ligne.repetitions, ligne.pourcentage,
            quoi + " : le total doit etre le PRODUIT du pas par le nombre de "
              + "repetitions, soit " + (ligne.pas * ligne.repetitions)
              + ", recu " + ligne.pourcentage);
        }

        /* Un coup RECOPIE se verifie contre la frappe qu'il copie. Le palier
           ne chiffre rien : il DESIGNE une frappe, et c'est le catalogue qui
           en publie le coefficient. Sans ce controle, le 315 stocke ici serait
           un nombre de plus tape a la main. */
        if(aUnCoupRecopie){
          const rang = ligne.frappeCopiee.rang;
          const coef = coupPublie(ligne.frappeCopiee.gameId, rang);
          assert.ok(coef !== null,
            quoi + " : le catalogue ne publie pas le coup n" + rang + " de "
              + ligne.frappeCopiee.gameId);
          assert.equal(ligne.coups * coef, ligne.pourcentage,
            quoi + " : " + ligne.coups + " coup(s) x " + coef + " % = "
              + (ligne.coups * coef) + ", la table stocke "
              + ligne.pourcentage);

          /* Et elle doit appartenir a une competence de la MEME categorie que
             le supplement : recopier une frappe d'ultime dans un supplement de
             competence normale n'aurait aucun sens, et rien d'autre ne le
             signalerait. */
          const copiee = (COMPETENCES[perso] || [])
            .find(k => k.gameId === ligne.frappeCopiee.gameId);
          assert.ok(copiee,
            quoi + " : gameId inconnu du catalogue de competences -> "
              + ligne.frappeCopiee.gameId);
          assert.equal(copiee.categorie, ligne.categorie,
            quoi + " : la frappe copiee est de categorie " + copiee.categorie
              + ", le supplement vise " + ligne.categorie);
        }

        /* La categorie annoncee doit exister CHEZ CE PERSONNAGE, avec CETTE
           arme. Une ligne rattachee a une categorie qu'il ne joue pas ne
           trouverait aucune competence a augmenter et resterait inerte. */
        const enum2 = {
          "Baguette":"Wand", "Baton":"Staff", "Bouclier":"Shield",
          "Epee 1 main":"Sword1h", "Epee 2 mains":"Sword2h",
          "Epees doubles":"SwordDual", "Gantelets":"Gauntlets", "Hache":"Axe",
          "Lance":"Lance", "Livre":"Book", "Nunchaku":"Cudgel3c",
          "Rapiere":"Rapier"
        }[arme];
        const kit = (COMPETENCES[perso] || [])
          .filter(k => k.weaponType === enum2 && k.categorie === ligne.categorie);
        assert.ok(kit.length > 0,
          quoi + " : aucune competence " + ligne.categorie + " chez " + perso
            + " avec " + arme + ". Ce supplement n'augmenterait rien.");
      });
    });
  });
});

/* Vingt-huit lignes de degats supplementaires sur les trente et une que les
   potentiels publient - les trois absentes sont NOMMEES dans l'en-tete de
   data/degats-supplementaires.js, leur total depend d'un nombre de coups que
   le texte ne publie pas - plus un coup RECOPIE, la vingt-neuvieme. */
assert.equal(comptees, 29, "29 lignes attendues, recu " + comptees);

/* Le module pur. */
{
  const { degatsSupplementairesApplicables, competenceAvecSupplements,
    degatsAttendus } = loadApp().hooks;
  assert.equal(typeof degatsSupplementairesApplicables, "function",
    "degatsSupplementairesApplicables doit etre expose par le chargeur");

  const pour = extra => degatsSupplementairesApplicables(Object.assign(
    { charId:"meliodas", typeArme:"Epee 1 main", palier:10 }, extra
  )).map(l => l.id);

  /* LE PALIER COMMANDE, cumulativement. */
  assert.deepEqual(plain(pour({})),
    ["meliodas-epee-1-main-t7-supplement",
      "meliodas-epee-1-main-t10-supplement"],
    "au palier 10, le T7 et le T10 sortent, dans l'ordre des paliers");
  assert.deepEqual(plain(pour({ palier:7 })),
    ["meliodas-epee-1-main-t7-supplement"],
    "au palier 7, le T10 ne doit pas sortir");
  assert.deepEqual(plain(pour({ palier:6 })), [],
    "au palier 6, rien n'est encore ouvert");
  assert.deepEqual(plain(pour({ palier:null })), [],
    "palier inconnu : rien, jamais tout");

  /* L'ARME commande aussi : les supplements de la Hache ne sont pas ceux de
     l'Epee 1 main. */
  assert.deepEqual(plain(pour({ typeArme:"Hache" })),
    ["meliodas-hache-t7-supplement"],
    "chaque arme a sa propre branche");
  assert.deepEqual(plain(pour({ charId:"inconnu" })), [],
    "un personnage absent de la table ne rend rien, et ne casse rien");

  /* LA COMPOSANTE. Le supplement s'ajoute a la competence de SA categorie, et
     a aucune autre. */
  const supplements = degatsSupplementairesApplicables({
    charId:"meliodas", typeArme:"Epee 1 main", palier:10
  });
  const normale = { categorie:"NORMAL_SKILL", pourcentage:286 };
  const augmentee = competenceAvecSupplements(normale, supplements);
  assert.deepEqual(plain(augmentee.composantes), [
    { base:"atk", pourcentage:286 },
    { base:"atk", pourcentage:220,
      supplement:"meliodas-epee-1-main-t7-supplement" }
  ], "le supplement de compétence normale doit rejoindre les composantes");
  assert.equal(augmentee.pourcentage, 286,
    "`pourcentage` decrit ce que la source publie et ne doit PAS bouger : un "
      + "test du catalogue exige qu'il egale la somme des composantes de data/");

  /* Une competence d'une AUTRE categorie ne bouge pas, et l'objet rendu est
     l'original - pas une copie qui aurait perdu un champ en chemin. */
  const speciale = { categorie:"ACTIVE_THIRD", pourcentage:100 };
  assert.equal(competenceAvecSupplements(speciale, supplements), speciale,
    "une competence sans supplement de sa categorie est rendue telle quelle");

  /* ET LE CHIFFRE BOUGE. C'est tout l'objet du chantier : sans supplement, la
     competence vaut son seul coefficient. */
  const cible = { def:0, critResist:0, critDmgResist:0, hp:null,
    resistanceElementaire:0, faiblesse:0, resistancePercement:0 };
  const stats = { atk:1000, critRate:0, critDamage:0 };
  const sans = degatsAttendus({ stats, competence:normale, cible });
  const avec = degatsAttendus({ stats, competence:augmentee, cible });
  assert.equal(Math.round(sans.total), 2860, "286 % de 1000 d'ATK");
  assert.equal(Math.round(avec.total), 5060, "286 % + 220 % de 1000 d'ATK");

  /* Le supplement traverse le bonus de CATEGORIE comme le reste de la
     competence : c'est le choix de modelisation, et il doit se voir. */
  const avecBonus = degatsAttendus({
    stats:Object.assign({}, stats, { bonusCategorie:11500 }),
    competence:augmentee, cible
  });
  assert.equal(Math.round(avecBonus.total), Math.round(5060 * 2.15),
    "les +115 % de competence normale portent AUSSI sur le supplement");
}

console.log("degats-supplementaires.test.js OK (" + comptees + " lignes sur "
  + Object.keys(TABLE).length + " personnages)");
