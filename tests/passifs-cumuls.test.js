"use strict";

/* La table des passifs a cumuls est ECRITE A LA MAIN, et c'est la seule des
   cinq dont la VALEUR ne se transcrit d'aucun texte du jeu : elle se mesure
   sur le mannequin. Ce test ne peut donc pas faire ce que font ses quatre
   voisins - chercher une phrase et comparer le nombre qui la suit.

   Ce qu'il verifie a la place, et qui reste verifiable :
     - le personnage, l'arme et le passif cite EXISTENT dans les catalogues ;
     - le PLAFOND de cumuls, lui, est publie par le jeu : il est relu dans le
       texte du passif, mot a mot, comme partout ailleurs ;
     - le total vaut le produit du bonus unitaire par le plafond, parce qu'un
       maximum qui se calcule ne se pose pas de tete ;
     - la ligne CHANGE quelque chose dans le moteur - une case cochee qui ne
       ferait rien serait la pire des sorties, silencieuse et fausse.

   La valeur elle-meme est protegee ailleurs : les trois releves de Derieri
   sont rejoues en test de non-regression dans tests/degats-calcul.test.js. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");

function catalogueDe(fichier, cle){
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
  );
  return bac.window[cle];
}

const TABLE = catalogueDe("passifs-cumuls.js", "SEVEN_DS_PASSIFS_CUMULS");
const WIKI = catalogueDe("wiki-competences.js", "SEVEN_DS_WIKI_COMPETENCES");
const COMPETENCES = catalogueDe("competences.js", "SEVEN_DS_COMPETENCES");

/* Les noms de dossier d'arme, source unique : js/noyau/constantes.js. Les
   recopier ici les ferait diverger le jour ou une arme s'ajoute. */
const FOLDER_TO_ENUM = (() => {
  const source = fs.readFileSync(
    path.join(racine, "js", "noyau", "constantes.js"), "utf8"
  );
  const bloc = /const FOLDER_TO_ENUM = \{([\s\S]*?)\};/.exec(source);
  assert.ok(bloc, "FOLDER_TO_ENUM introuvable dans js/noyau/constantes.js");
  const table = {};
  bloc[1].replace(/"([^"]+)"\s*:\s*"([^"]+)"/g, (tout, dossier, enumArme) => {
    table[dossier] = enumArme;
    return tout;
  });
  return table;
})();

const nu = texte => (texte || "").replace(/\[#?[0-9A-Fa-f-]*\]/g, "");
const identifiants = new Set();
let lignes = 0;

Object.keys(TABLE).forEach(perso => {
  assert.ok(WIKI[perso],
    "personnage inconnu du catalogue du wiki : " + perso);

  Object.keys(TABLE[perso]).forEach(arme => {
    const enumArme = FOLDER_TO_ENUM[arme];
    assert.ok(enumArme,
      perso + " : arme inconnue « " + arme + " ». La cle est un nom de "
        + "DOSSIER (« Gantelets »), pas l'enum du catalogue (« Gauntlets »).");
    /* Le personnage doit vraiment jouer cette arme. Sans ce controle, une
       branche mal orthographiee resterait muette : le calculateur ne la
       trouverait jamais, et personne ne verrait qu'elle ne sort pas. */
    assert.ok((COMPETENCES[perso] || []).some(c => c.weaponType === enumArme),
      perso + " : aucune competence pour l'arme " + arme + " (" + enumArme
        + "). Ce personnage ne la joue pas.");

    TABLE[perso][arme].forEach(ligne => {
      lignes++;
      const quoi = ligne.id;
      assert.ok(!identifiants.has(quoi), "identifiant en double : " + quoi);
      identifiants.add(quoi);

      /* Ces lignes portent un EFFET, jamais un code de stat : le jeu n'expose
         aucune statistique « degats, toutes categories ». Le plan initial
         citait AllSkill_Add et AllCategory_Add, qui n'existent nulle part. */
      assert.equal(typeof ligne.effet, "string",
        quoi + " : un effet est attendu, pas un code de stat.");
      assert.ok(!Object.prototype.hasOwnProperty.call(ligne, "stat"),
        quoi + " : une ligne porte SOIT un effet SOIT un code de stat.");
      assert.equal(ligne.unite, "ten-thousandths",
        quoi + " : les taux se stockent en dix-milliemes.");

      /* Le produit. Le seul calcul que cette table contienne, donc le seul
         endroit ou une faute de frappe passerait inapercue. */
      assert.ok(Number.isFinite(ligne.parCumul) && ligne.parCumul > 0,
        quoi + " : parCumul doit etre un nombre positif.");
      assert.ok(Number.isInteger(ligne.cumuls) && ligne.cumuls > 0,
        quoi + " : cumuls doit etre un entier positif.");
      assert.ok(Math.abs(ligne.valeur - ligne.parCumul * ligne.cumuls) < 1e-6,
        quoi + " : valeur (" + ligne.valeur + ") doit valoir parCumul x "
          + "cumuls (" + ligne.parCumul * ligne.cumuls + ").");

      /* Le PLAFOND, lui, est publie. Il se relit dans le texte du passif cite,
         exactement comme les quatre autres tables relisent leurs valeurs. */
      const fiche = (WIKI[perso] || []).find(k => k.gameId === ligne.gameId);
      assert.ok(fiche,
        quoi + " : gameId inconnu du catalogue du wiki, « "
          + ligne.gameId + " ».");
      assert.equal(fiche.weaponType, enumArme,
        quoi + " : le passif cite appartient a l'arme " + fiche.weaponType
          + ", pas a " + enumArme + ".");
      const texte = nu(fiche.descriptionFr);
      const phrase = "(Max : ";
      const morceaux = texte.split(phrase);
      assert.equal(morceaux.length, 2,
        quoi + " : « " + phrase + " » doit apparaitre EXACTEMENT une fois "
          + "dans le texte du passif, trouvee " + (morceaux.length - 1)
          + " fois.");
      const publie = /^(\d+)/.exec(morceaux[1]);
      assert.ok(publie,
        quoi + " : aucun nombre ne suit « " + phrase + " ».");
      assert.equal(Number(publie[1]), ligne.cumuls,
        quoi + " : le jeu publie un plafond de " + publie[1] + " cumuls, la "
          + "table en stocke " + ligne.cumuls + ".");
    });
  });
});

assert.ok(lignes > 0, "la table est vide : ce test ne prouverait rien.");

/* Branchement reel. Deux verifications que la table seule ne peut pas rendre :
   la ligne SORT pour le bon couple personnage/arme, et elle CHANGE une entree
   du moteur une fois cochee. */
{
  const { loadApp } = require("./helpers/load-app");
  const hooks = loadApp().hooks;
  const { passifsCumulsApplicables, entreesDuCalcul } = hooks;
  assert.equal(typeof passifsCumulsApplicables, "function",
    "passifsCumulsApplicables n'est pas exposee par le chargeur de tests.");

  const NEUTRE = {
    atk:1000, attaqueElementaire:500, def:400, maxHp:20000,
    critRate:3000, critDamage:12000, percementDefense:500
  };
  Object.keys(TABLE).forEach(perso =>
    Object.keys(TABLE[perso]).forEach(arme => {
      const sorties = passifsCumulsApplicables({ charId:perso, typeArme:arme });
      assert.equal(sorties.length, TABLE[perso][arme].length,
        perso + " / " + arme + " : le module ne rend pas toutes les lignes.");

      /* Une arme que ce personnage ne porte pas ne doit RIEN rendre : sans ce
         controle, une table mal indexee arroserait tous ses builds. */
      const autre = Object.keys(FOLDER_TO_ENUM).find(a => a !== arme);
      const fuites = passifsCumulsApplicables({ charId:perso, typeArme:autre })
        .filter(l => TABLE[perso][arme].some(r => r.id === l.id));
      assert.equal(fuites.length, 0,
        perso + " : les lignes de " + arme + " fuient vers " + autre + ".");

      sorties.forEach(ligne => {
        const nues = entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[] });
        const avec = entreesDuCalcul({
          statsDuBuild:NEUTRE, buffsCoches:[ligne]
        });
        assert.ok(Object.keys(nues).some(cle => nues[cle] !== avec[cle]),
          ligne.id + " : cette ligne ne change AUCUNE entree du moteur. Son "
            + "effet n'est branche nulle part, donc la case serait cochee "
            + "sans rien faire.");
      });
    })
  );
}

console.log("passifs-cumuls.test.js OK (" + lignes + " ligne(s) sur "
  + Object.keys(TABLE).length + " personnage(s))");
