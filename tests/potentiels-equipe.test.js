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
/* Le depot nomme ses statistiques dans DEUX fichiers, et l'application lit les
   deux : `libelles-stats.json` vient du jeu, `stat-labels-supplement.json`
   comble les codes que le jeu porte sans les nommer — `AllElement_Rate` en est
   un. Ne lire que le premier ferait refuser un code parfaitement connu du
   catalogue. */
const LIBELLES = Object.assign(
  JSON.parse(fs.readFileSync(
    path.join(racine, "7ds-stats", "libelles-stats.json"), "utf8"
  )),
  Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(
    path.join(racine, "7ds-stats", "stat-labels-supplement.json"), "utf8"
  ))).map(([code, fr]) => [code, { fr }]))
);

const { EFFETS_SUR_LA_CIBLE,
  CATEGORIES_DE_COMPETENCE } = require("./helpers/effets-cible");

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
          assert.ok(EFFETS_SUR_LA_CIBLE.includes(ligne.effet),
            quoi + " : effet inconnu sur la cible -> " + ligne.effet);
          assert.equal(ligne.cibleEnnemi, true,
            quoi + " : un effet sur la cible doit porter cibleEnnemi:true");
          /* Une vulnerabilite DOIT nommer sa categorie : sans elle, elle
             tomberait dans aucun seau et serait cochable sans rien faire. */
          if(ligne.effet === "vulnerabiliteCategorie"){
            assert.ok(CATEGORIES_DE_COMPETENCE.includes(ligne.categorie),
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
        /* Une ligne indexee SANS plafond n'a aucun repli honnete : elle vaut
           zero tant que la statistique du lanceur n'est pas lisible. Partout
           ailleurs, zero signalerait une valeur oubliee. */
        const indexeSansPlafond = Boolean(ligne.indexeSurDef)
          && !Object.prototype.hasOwnProperty.call(ligne.indexeSurDef, "plafond");
        assert.ok(
          typeof ligne.valeur === "number"
            && (indexeSansPlafond ? ligne.valeur === 0 : ligne.valeur > 0),
          quoi + " : une valeur absente s'omet, elle ne vaut jamais zero");

        /* LA GARDE. Le nombre qui suit la phrase citee doit valoir la valeur
           stockee - ou, pour une ligne indexee sur l'ATK, son TAUX ; ou, pour
           une valeur a cumuls, le pas d'UN cumul. */
        const aDesCumuls = Object.prototype.hasOwnProperty.call(ligne, "cumuls");
        const brut = aDesCumuls ? ligne.parCumul : ligne.valeur;
        const indexation = ligne.indexeSurAtk || ligne.indexeSurDef;
        const attenduPrincipal = indexation
          ? indexation.taux / 100
          : (ligne.unite === "ten-thousandths" ? brut / 100 : brut);
        assert.equal(
          nombreApres(texte, ligne.provenance.phrase, quoi), attenduPrincipal,
          quoi + " : le texte du palier " + palier + " annonce un autre nombre "
            + "que la table"
        );

        /* Le plafond ne se DEDUIT pas du taux : il a sa propre phrase, et son
           propre nombre a verifier. Le repli `valeur` doit lui rester egal,
           faute de quoi il cesserait d'etre le plafond sans rien dire. */
        if(indexation){
          assert.equal(ligne.unite, "flat",
            quoi + " : une valeur indexee est plate, pas un taux");
          const plafonnee = Object.prototype
            .hasOwnProperty.call(indexation, "plafond");
          if(plafonnee){
            assert.ok(ligne.provenance.phrasePlafond,
              quoi + " : une ligne plafonnee doit citer la phrase de son plafond");
            assert.equal(
              nombreApres(texte, ligne.provenance.phrasePlafond, quoi + " (plafond)"),
              indexation.plafond,
              quoi + " : le plafond annonce par le texte differe de la table");
            assert.equal(indexation.plafond, ligne.valeur,
              quoi + " : le plafond et la valeur de repli doivent rester egaux");
          }else{
            /* Pas de plafond dans le texte, pas de plafond dans la table. Le
               palier 10 du Livre d'Elizabeth suit la defense du lanceur sans
               borne annoncee ; en inventer une la trahirait. */
            assert.ok(!Object.prototype.hasOwnProperty.call(ligne.provenance, "phrasePlafond"),
              quoi + " : une ligne sans plafond ne doit pas en citer un");
            assert.equal(ligne.valeur, 0,
              quoi + " : sans plafond, le repli ne peut valoir que zero");
          }
        }else{
          assert.ok(!Object.prototype.hasOwnProperty.call(ligne, "phrasePlafond"),
            quoi + " : un plafond n'a de sens que sur une ligne indexee");
        }

        /* LES CUMULS. Une valeur a cumuls est un PRODUIT, et le produit se
           VERIFIE : deux phrases, deux nombres, et `valeur` comparee a leur
           multiplication. Sans cela, « 5 % x 20 cumuls = 100 % » serait un
           calcul de tete que rien ne relirait - et une erreur de facteur dix
           passerait sans bruit. */
        assert.equal(aDesCumuls,
          Object.prototype.hasOwnProperty.call(ligne, "parCumul"),
          quoi + " : `cumuls` et `parCumul` vont ensemble, ou pas du tout");
        assert.equal(aDesCumuls,
          Object.prototype.hasOwnProperty.call(ligne.provenance, "phraseCumuls"),
          quoi + " : une valeur a cumuls doit citer la phrase de son compte");
        if(aDesCumuls){
          assert.ok(Number.isInteger(ligne.cumuls) && ligne.cumuls > 1,
            quoi + " : un compte de cumuls est un entier superieur a un");
          assert.equal(
            nombreApres(texte, ligne.provenance.phraseCumuls, quoi + " (cumuls)"),
            ligne.cumuls,
            quoi + " : le texte annonce un autre nombre de cumuls que la table");
          assert.equal(ligne.parCumul * ligne.cumuls, ligne.valeur,
            quoi + " : la valeur doit etre le PRODUIT du pas par le nombre de "
              + "cumuls, soit " + (ligne.parCumul * ligne.cumuls) + ", recu "
              + ligne.valeur);
        }
      });
    });
  });
});

/* Les lignes que les soutiens tournent vers l'equipe ou la cible. Celles qui
   restent dehors sont NOMMEES dans l'en-tete de data/potentiels-equipe.js avec
   la raison de leur absence. Ce compte empeche qu'un oubli passe inapercu.

   Passe de 16 a 18 le 24 aout 2026 : les paliers 6 et 10 du Baton d'Elizabeth
   augmentent le boost de degats crit. d'attaque normale que son attaque
   speciale donne aux allies. La table du jeu donne la suite exacte,
   +50 % / +70 % / +100 %. */
assert.equal(lignes, 19, "19 lignes attendues, recu " + lignes);

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

  /* LE PALIER COMMANDE, et il commande CUMULATIVEMENT : au palier 10, les
     trois paliers ecrits sortent ; au palier 6, les deux premiers ; au palier
     4, aucun. C'est le coeur de ce module - sans lui, un coequipier a peine
     debloque rendrait les buffs d'un palier 10. */
  assert.deepEqual(plain(idsPour({ estLeHeros:true }).sort()),
    ["gowther-baton-t10-degats-crit", "gowther-baton-t5-resistance-crit",
      "gowther-baton-t6-attaque-foudre"],
    "au palier 10, les trois paliers ecrits doivent sortir");
  assert.deepEqual(plain(idsPour({ palier:6, estLeHeros:true })),
    ["gowther-baton-t5-resistance-crit", "gowther-baton-t6-attaque-foudre"],
    "au palier 6, le palier 10 ne doit pas sortir");
  assert.deepEqual(plain(idsPour({ palier:5, estLeHeros:true })),
    ["gowther-baton-t5-resistance-crit"],
    "au palier 5, seul le premier palier ecrit est ouvert");
  assert.deepEqual(plain(idsPour({ palier:4, estLeHeros:true })), [],
    "au palier 4, rien de ce qui est ecrit n'est encore ouvert");
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

  /* Un potentiel « soi » porte par un COEQUIPIER n'atteint pas le heros - ici
     le T10, seul des trois a ne viser que son porteur. */
  assert.deepEqual(plain(idsPour({})),
    ["gowther-baton-t5-resistance-crit", "gowther-baton-t6-attaque-foudre"],
    "le potentiel « soi » d'un coequipier ne doit pas atteindre le heros");

  /* L'element filtre par-dessus, comme pour les soutiens et les tenues, et il
     ne mord QUE sur les lignes qui nomment un element : le T5 vise l'ennemi
     sans condition d'attribut, donc il survit a un build Feu. */
  assert.deepEqual(
    plain(potentielsEquipeApplicables({
      element:"fire", porteurs:[porteur({ estLeHeros:true })]
    }).map(l => l.id)),
    ["gowther-baton-t5-resistance-crit"],
    "un build Feu ne recoit pas les potentiels FOUDRE de Gowther, mais garde "
      + "ce qui n'a pas d'element");

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

  /* Une ligne indexee sur la DEFENSE du lanceur, et SANS plafond : elle suit
     la defense aussi haut qu'elle monte, et ne vaut rien tant que le build du
     lanceur n'est pas lisible. */
  const surDefense = def => potentielsEquipeApplicables({
    element:"wind",
    porteurs:[{ charId:"elizabeth", typeArme:"Livre", palier:10,
      estLeHeros:false, def }]
  }).find(l => l.id === "elizabeth-livre-t10-attaque-sur-defense");
  assert.equal(surDefense(8000).valeur, 800, "10 % de 8 000 valent 800");
  assert.equal(surDefense(8000).repli, false);
  assert.equal(surDefense(60000).valeur, 6000,
    "sans plafond, la valeur suit la defense sans etre bornee");
  assert.equal(surDefense(null).valeur, 0, "defense inconnue : rien");
  assert.equal(surDefense(null).repli, true, "et le drapeau doit etre leve");

  /* AUCUNE LIGNE INERTE. Cochee, une ligne doit changer quelque chose : soit
     une entree du moteur, soit un bonus de categorie. Ce filet a deja attrape
     des codes de stat inventes ailleurs.

     Une ligne indexee arrive au moteur DEJA CHIFFREE - c'est
     potentielsEquipeApplicables qui la resout - donc on la coche ici comme la
     production la coche, valeur resolue. La cocher brute la ferait passer pour
     inerte alors qu'elle ne l'est pas. */
  const NEUTRE = {
    atk:1000, attaqueElementaire:500, def:400, maxHp:20000,
    critRate:3000, critDamage:12000, percementDefense:500
  };
  const commeEnProduction = ligne => {
    const indexation = ligne.indexeSurAtk || ligne.indexeSurDef;
    if(!indexation) return ligne;
    return Object.assign({}, ligne, { valeur:indexation.taux });
  };
  Object.keys(TABLE).forEach(perso =>
    Object.keys(TABLE[perso]).forEach(arme =>
      Object.keys(TABLE[perso][arme]).forEach(palier =>
        TABLE[perso][arme][palier].forEach(ligne => {
          const nuEntrees = entreesDuCalcul({
            statsDuBuild:NEUTRE, buffsCoches:[]
          });
          const avec = entreesDuCalcul({
            statsDuBuild:NEUTRE, buffsCoches:[commeEnProduction(ligne)]
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

/* LE PALIER 7 DU LIVRE D'ELIZABETH porte un TAUX, pas des points.

   La table du jeu tranche : `grade_7_elizabeth_book_skill_r` pose le buff
   302171046, dont l'unique ligne est `AllElement_Rate = 3000`, ApplyType Team.
   `AllElement_Add` — « Attaque de tous les elements » — est le code voisin, en
   POINTS, et le confondre range un taux dans un seau de valeurs plates. */
{
  const { entreesDuCalcul } = loadApp().hooks;
  const ligne = TABLE.elizabeth.Livre["7"][0];
  assert.equal(ligne.stat, "AllElement_Rate",
    "le palier 7 du Livre est un taux d'attaque elementaire, pas des points");
  const entrees = entreesDuCalcul({
    statsDuBuild:{
      atk:1000, def:0, maxHp:0, critRate:0, critDamage:0,
      attaqueElementaire:1000, bonusElementaire:0, bonusGlobal:0
    },
    buffsCoches:[ligne]
  });
  assert.equal(entrees.attaqueElementaire, 1300,
    "ce palier doit atteindre le seau de l'attaque elementaire");
}

/* LE PALIER 10 DU LIVRE D'ELIZABETH entre dans la FICHE DE STATISTIQUES.

   « Augmente l'attaque de tous les heros allies a hauteur de 10 % de la
   defense du heros » donne des POINTS d'attaque : sa place est a cote de
   l'equipement et des maitrises, pas seulement dans une case a cocher. */
{
  const { termesDEquipe } = loadApp().hooks;
  assert.equal(typeof termesDEquipe, "function",
    "termesDEquipe n'est pas exposee par le chargeur de tests");

  const elizabeth = {
    charId:"elizabeth", typeArme:"Livre", palier:10,
    atk:20000, def:12340, estLeHeros:false
  };
  const termes = plain(termesDEquipe({ element:"dark", porteurs:[elizabeth] }));
  assert.equal(termes.length, 1, "un seul potentiel d'equipe rend des points");
  const terme = termes[0];
  assert.equal(terme.stat, "B_Atk");
  assert.equal(terme.value, 1234, "10 % de 12 340");
  assert.equal(terme.unit, "flat");
  assert.equal(terme.operation, "add");
  assert.equal(terme.source.domain, "equipe");
  assert.equal(terme.source.tier, 10);
  assert.equal(terme.source.support, "elizabeth");

  /* Un palier trop bas ne rend rien, et une defense illisible non plus : servir
     un plafond faute de build se defend dans une case a cocher, qui s'annonce,
     pas dans un total de statistiques qui se lit comme un fait. */
  assert.deepEqual(
    plain(termesDEquipe({ element:"dark",
      porteurs:[Object.assign({}, elizabeth, { palier:9 })] })),
    [], "le palier 9 ne donne pas l'attaque du palier 10"
  );
  assert.deepEqual(
    plain(termesDEquipe({ element:"dark",
      porteurs:[Object.assign({}, elizabeth, { def:0 })] })),
    [], "sans defense lisible, aucun terme"
  );
  assert.deepEqual(
    plain(termesDEquipe({ element:"dark", porteurs:[] })), [],
    "sans coequipier, aucun terme"
  );
}

/* UNE LIGNE INDEXEE DIT SON CHIFFRE. « 10 % de la defense du heros » n'apprend
   rien tant qu'on ne sait pas ce que vaut cette defense. */
{
  const { pointsDunApportIndexe } = loadApp().hooks;
  assert.equal(typeof pointsDunApportIndexe, "function",
    "pointsDunApportIndexe n'est pas exposee par le chargeur de tests");

  /* Le separateur de milliers francais est une espace fine INSECABLE (U+202F),
     celle que rend Intl. L'ecrire en clair dans ce fichier la rendrait
     indiscernable d'une espace ordinaire a la relecture — et un outil
     d'edition la remplacerait sans bruit. */
  const FINE = String.fromCharCode(0x202f);
  assert.equal(
    pointsDunApportIndexe({
      stat:"B_Atk", unite:"flat", valeur:1234, indexeSurDef:{ taux:1000 }
    }),
    "+1" + FINE + "234 points d’attaque pour chaque allié"
  );
  /* Une ligne qui n'est indexee sur RIEN annonce deja sa valeur dans son
     libelle : la repeter serait du bruit. */
  assert.equal(
    pointsDunApportIndexe({ stat:"C_Critical_Rate", unite:"ten-thousandths",
      valeur:1000 }),
    null
  );
  /* Un taux ne se compte pas en points. */
  assert.equal(
    pointsDunApportIndexe({ stat:"B_Atk", unite:"ten-thousandths",
      valeur:1000, indexeSurDef:{ taux:1000 } }),
    null
  );
  assert.equal(
    pointsDunApportIndexe({ stat:"B_Atk", unite:"flat", valeur:0,
      indexeSurDef:{ taux:1000 } }),
    null, "zero point n'a rien a annoncer"
  );
}

console.log("potentiels-equipe.test.js OK (" + lignes + " lignes)");
