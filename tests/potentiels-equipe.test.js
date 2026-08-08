"use strict";

/* La table des potentiels tournes vers l'equipe est ECRITE A LA MAIN. Ce test
   tient lieu de generateur.

   Sa regle centrale, la meme que pour les tenues gravees : la PHRASE citee est
   choisie pour que le nombre qui la suit immediatement SOIT la valeur stockee.
   Le test la cherche dans le texte du palier et compare. Sans cela, rien
   n'empecherait d'attribuer a un effet la valeur d'un autre - ces paliers en
   portent deux ou trois chacun - et l'erreur serait MUETTE : aucun test ne
   casse, seuls les degats sont faux. */

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

const TABLE = catalogueDe("potentiels-equipe.js", "SEVEN_DS_POTENTIELS_EQUIPE");
const SOURCE = catalogueDe("potentiels.js", "SEVEN_DS_POTENTIELS");
const LIBELLES = JSON.parse(fs.readFileSync(
  path.join(racine, "7ds-stats", "libelles-stats.json"), "utf8"
));

/* Les cinq categories du catalogue de competences, celles que le moteur
   distingue. Une vulnerabilite doit en nommer une. */
const CATEGORIES = [
  "NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL"
];

const nu = texte => (texte || "").replace(/\[#?[0-9A-Fa-f-]*\]/g, "");
const identifiants = new Set();
let lignes = 0;

/* Le nombre qui suit une phrase dans un texte, apres avoir verifie que la
   phrase s'y trouve EXACTEMENT une fois - sinon on ne saurait pas de quel
   nombre on parle. */
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
      const texte = nu(paliers[rang - 1]);

      TABLE[perso][arme][palier].forEach(ligne => {
        lignes++;
        const quoi = ligne.id;
        assert.ok(!identifiants.has(quoi), "identifiant en double : " + quoi);
        identifiants.add(quoi);

        /* Une ligne porte SOIT un code de stat du heros, SOIT un effet sur la
           cible. Jamais les deux, jamais aucun : sans cette exclusion, une
           ligne mal ecrite tomberait dans la branche permissive. */
        const surLaCible = Object.prototype.hasOwnProperty.call(ligne, "effet");
        assert.notEqual(surLaCible,
          Object.prototype.hasOwnProperty.call(ligne, "stat"),
          quoi + " : une ligne porte `stat` OU `effet`, exactement un des deux");
        if(surLaCible){
          assert.ok(
            ["defense", "defenseCritique", "vulnerabiliteCategorie"]
              .includes(ligne.effet),
            quoi + " : effet inconnu sur la cible -> " + ligne.effet);
          assert.equal(ligne.cibleEnnemi, true,
            quoi + " : un effet sur la cible doit porter cibleEnnemi:true");
          /* Une vulnerabilite DOIT nommer sa categorie : sans elle, elle
             tomberait dans aucun seau et serait cochable sans rien faire. */
          if(ligne.effet === "vulnerabiliteCategorie"){
            assert.ok(CATEGORIES.includes(ligne.categorie),
              quoi + " : categorie inconnue -> " + ligne.categorie);
          }
        }else{
          assert.ok(Object.prototype.hasOwnProperty.call(LIBELLES, ligne.stat),
            quoi + " : code de stat inconnu du depot -> " + ligne.stat);
        }

        assert.ok(["soi", "allies"].includes(ligne.cible),
          quoi + " : cible doit valoir \"soi\" ou \"allies\"");
        assert.ok(["add", "multiply"].includes(ligne.operation),
          quoi + " : operation invalide -> " + ligne.operation);
        assert.ok(["flat", "ten-thousandths"].includes(ligne.unite),
          quoi + " : unite invalide -> " + ligne.unite);
        assert.ok(ligne.libelle && ligne.libelle.trim(),
          quoi + " : une ligne sans libelle est illisible a l'ecran");
        assert.ok(typeof ligne.valeur === "number" && ligne.valeur > 0,
          quoi + " : une valeur absente s'omet, elle ne vaut jamais zero");

        /* LA GARDE. Le nombre qui suit la phrase citee doit valoir la valeur
           stockee - ou, pour une ligne indexee sur l'ATK, son TAUX. */
        const attenduPrincipal = ligne.indexeSurAtk
          ? ligne.indexeSurAtk.taux / 100
          : (ligne.unite === "ten-thousandths"
            ? ligne.valeur / 100 : ligne.valeur);
        assert.equal(
          nombreApres(texte, ligne.provenance.phrase, quoi), attenduPrincipal,
          quoi + " : le texte du palier " + palier + " annonce un autre nombre "
            + "que la table"
        );

        /* Le plafond ne se DEDUIT pas du taux : il a sa propre phrase, et son
           propre nombre a verifier. Le repli `valeur` doit lui rester egal,
           faute de quoi il cesserait d'etre le plafond sans rien dire. */
        if(ligne.indexeSurAtk){
          assert.ok(ligne.provenance.phrasePlafond,
            quoi + " : une ligne indexee doit citer la phrase de son plafond");
          assert.equal(
            nombreApres(texte, ligne.provenance.phrasePlafond, quoi + " (plafond)"),
            ligne.indexeSurAtk.plafond,
            quoi + " : le plafond annonce par le texte differe de la table");
          assert.equal(ligne.indexeSurAtk.plafond, ligne.valeur,
            quoi + " : le plafond et la valeur de repli doivent rester egaux");
          assert.equal(ligne.unite, "flat",
            quoi + " : une valeur indexee sur l'ATK est plate, pas un taux");
        }else{
          assert.ok(!Object.prototype.hasOwnProperty.call(ligne, "phrasePlafond"),
            quoi + " : un plafond n'a de sens que sur une ligne indexee");
        }
      });
    });
  });
});

/* Quatorze lignes sur les vingt-sept que les huit soutiens tournent vers
   l'equipe ou la cible. Les treize autres sont NOMMEES dans l'en-tete de
   data/potentiels-equipe.js avec la raison de leur absence. Ce compte empeche
   qu'un oubli passe inapercu. */
assert.equal(lignes, 14, "14 lignes attendues, recu " + lignes);

/* data/potentiels.js n'emploie PAS d'espace insecable, contrairement a
   stats-build.js. Si la source changeait d'avis, les phrases citees ici
   cesseraient de correspondre : autant le dire tout de suite plutot que de
   laisser la garde echouer sans expliquer pourquoi. */
{
  const brut = fs.readFileSync(
    path.join(racine, "data", "potentiels.js"), "utf8"
  );
  assert.ok(!brut.includes(String.fromCharCode(0xa0)),
    "data/potentiels.js contient desormais des espaces insecables : les "
      + "phrases citees dans potentiels-equipe.js doivent les echapper, comme "
      + "le fait passifs-graves.js");
}

/* Le module pur : qui recoit quoi, a quel palier, avec quelle arme. */
{
  const { potentielsEquipeApplicables, entreesDuCalcul,
    bonusCategorieDesBuffs } = loadApp().hooks;
  assert.equal(typeof potentielsEquipeApplicables, "function",
    "potentielsEquipeApplicables doit etre expose par le chargeur de tests");

  const porteur = extra => Object.assign(
    { charId:"gowther", typeArme:"Baton", palier:10, atk:null,
      estLeHeros:false }, extra
  );
  const idsPour = extra => potentielsEquipeApplicables({
    element:"thunder", porteurs:[porteur(extra)]
  }).map(ligne => ligne.id);

  /* LE PALIER COMMANDE. Au palier 10, le T6 et le T10 sortent ; au palier 6,
     le T6 seul ; au palier 5, rien. C'est le coeur de ce module : sans lui, un
     coequipier a peine debloque rendrait les buffs d'un palier 10. */
  assert.deepEqual(plain(idsPour({ estLeHeros:true }).sort()),
    ["gowther-baton-t10-degats-crit", "gowther-baton-t6-attaque-foudre"],
    "au palier 10, les deux paliers ecrits doivent sortir");
  assert.deepEqual(plain(idsPour({ palier:6, estLeHeros:true })),
    ["gowther-baton-t6-attaque-foudre"],
    "au palier 6, le palier 10 ne doit pas sortir");
  assert.deepEqual(plain(idsPour({ palier:5, estLeHeros:true })), [],
    "au palier 5, rien de ce qui est ecrit n'est encore ouvert");
  assert.deepEqual(plain(idsPour({ palier:null, estLeHeros:true })), [],
    "palier inconnu : rien, jamais tout");

  /* L'ARME commande aussi : la branche Livre de Gowther ne rend pas celle du
     Baton. */
  assert.deepEqual(
    plain(potentielsEquipeApplicables({
      element:"thunder",
      porteurs:[porteur({ typeArme:"Livre", estLeHeros:true })]
    }).map(l => l.id)),
    ["gowther-livre-t10-defense-crit"],
    "chaque arme a sa propre branche de potentiels");

  /* Un potentiel « soi » porte par un COEQUIPIER n'atteint pas le heros. */
  assert.deepEqual(plain(idsPour({})), ["gowther-baton-t6-attaque-foudre"],
    "le potentiel « soi » d'un coequipier ne doit pas atteindre le heros");

  /* L'element filtre par-dessus, comme pour les soutiens et les tenues. */
  assert.deepEqual(
    plain(potentielsEquipeApplicables({
      element:"fire", porteurs:[porteur({ estLeHeros:true })]
    })),
    [],
    "un build Feu ne recoit pas les potentiels Foudre de Gowther");

  /* Une ligne indexee sur l'ATK : chiffree quand l'ATK est connue, au plafond
     sinon, et le drapeau `repli` dit lequel des deux. */
  const indexee = extra => potentielsEquipeApplicables({
    element:"dark",
    porteurs:[{ charId:"derieri", typeArme:"Hache", palier:10,
      estLeHeros:false, atk:extra }]
  }).find(l => l.id === "derieri-hache-t10-attaque-tenebres");
  assert.equal(indexee(10000).valeur, 3000, "30 % de 10 000 valent 3 000");
  assert.equal(indexee(10000).repli, false);
  assert.equal(indexee(50000).valeur, 4000, "le plafond borne le chiffre");
  assert.equal(indexee(null).valeur, 4000, "ATK inconnue : le plafond");
  assert.equal(indexee(null).repli, true, "et le drapeau doit etre leve");

  /* AUCUNE LIGNE INERTE. Cochee, une ligne doit changer quelque chose : soit
     une entree du moteur, soit un bonus de categorie. Ce filet a deja attrape
     des codes de stat inventes ailleurs. */
  const NEUTRE = {
    atk:1000, attaqueElementaire:500, def:400, maxHp:20000,
    critRate:3000, critDamage:12000, percementDefense:500
  };
  Object.keys(TABLE).forEach(perso =>
    Object.keys(TABLE[perso]).forEach(arme =>
      Object.keys(TABLE[perso][arme]).forEach(palier =>
        TABLE[perso][arme][palier].forEach(ligne => {
          const nuEntrees = entreesDuCalcul({
            statsDuBuild:NEUTRE, buffsCoches:[]
          });
          const avec = entreesDuCalcul({
            statsDuBuild:NEUTRE, buffsCoches:[ligne]
          });
          const changeLeMoteur = Object.keys(nuEntrees)
            .some(cle => nuEntrees[cle] !== avec[cle]);
          const changeUneCategorie =
            Object.keys(bonusCategorieDesBuffs([ligne])).length > 0;
          assert.ok(changeLeMoteur || changeUneCategorie,
            ligne.id + " : ce potentiel ne change NI une entree du moteur NI "
              + "un bonus de categorie. Il serait coche sans rien faire.");
        }))));

  /* LA VULNERABILITE atterrit bien dans le seau de SA categorie, et d'aucune
     autre. C'est le choix de modelisation valide avec le membre : une
     propriete de la cible versee dans le seau additif des bonus, par analogie
     avec la faiblesse mesuree chez l'outil de reference. */
  const vulnerabilite = TABLE.derieri.Hache["7"][0];
  assert.deepEqual(plain(bonusCategorieDesBuffs([vulnerabilite])),
    { NORMAL_SKILL:5000 },
    "la vulnerabilite doit se poser sur sa seule categorie");
  const entrees = entreesDuCalcul({
    statsDuBuild:NEUTRE, buffsCoches:[vulnerabilite]
  });
  assert.equal(entrees.bonusCategorie, 0,
    "elle ne doit PAS passer par le seau commun, qui vaut pour toutes les "
      + "competences a la fois");
}

console.log("potentiels-equipe.test.js OK (" + lignes + " lignes)");
