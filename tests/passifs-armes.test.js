"use strict";

/* Le passif de l'arme de Derieri est transcrit depuis les sept niveaux publies
   par le jeu. Le test protege trois erreurs distinctes : un mauvais chiffre,
   une ancre qui viserait la seconde phrase du passif, et un code de stat qui
   ne serait lu par personne. */

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

function texteNet(texte){
  return String(texte || "").replace(/\[[^\]]*\]/g, "");
}

function nombreApres(texte, phrase, quoi){
  const morceaux = texte.split(phrase);
  assert.equal(morceaux.length, 2,
    quoi + " : « " + phrase + " » doit apparaitre exactement une fois, trouvee "
      + (morceaux.length - 1) + " fois.");
  const trouve = /^(\d+(?:\.\d+)?)%/.exec(morceaux[1]);
  assert.ok(trouve, quoi + " : aucun pourcentage ne suit « " + phrase + " ».");
  return Number(trouve[1]) * 100;
}

const TABLE = catalogueDe("passifs-armes.js", "SEVEN_DS_PASSIFS_ARMES");
const BUILD = catalogueDe("stats-build.js", "SEVEN_DS_BUILD_STATS");
const identifiants = new Set();
let lignes = 0;

Object.entries(TABLE).forEach(([fichier, passifs]) => {
  const arme = BUILD.weaponsByFile[fichier];
  assert.ok(arme, "arme inconnue du catalogue : " + fichier);
  assert.ok(Array.isArray(passifs) && passifs.length,
    fichier + " : au moins un passif est attendu.");

  passifs.forEach(passif => {
    lignes++;
    assert.ok(!identifiants.has(passif.id), "identifiant en double : " + passif.id);
    identifiants.add(passif.id);
    assert.ok(BUILD.statLabels[passif.stat],
      passif.id + " : code de stat inconnu : " + passif.stat);
    assert.equal(passif.stat, "AllElement_Rate",
      passif.id + " : la mesure oblige le taux de toute l'attaque elementaire.");
    assert.equal(passif.operation, "add", passif.id + " : operation attendue : add.");
    assert.equal(passif.unite, "ten-thousandths",
      passif.id + " : les taux se stockent en dix-milliemes.");
    assert.equal(passif.cumuls, 40, passif.id + " : le plafond est 40 cumuls.");
    assert.equal(passif.niveaux.length, 7, passif.id + " : sept niveaux attendus.");
    assert.equal(passif.parCumul.length, 7,
      passif.id + " : sept pas de cumul attendus.");

    arme.passiveLevels.forEach((niveau, index) => {
      const texte = texteNet(niveau.textFr);
      const quoi = passif.id + " niveau " + niveau.level;
      assert.equal(nombreApres(texte, passif.provenance.phrase, quoi),
        passif.niveaux[index], quoi + " : plafond mal transcrit.");
      assert.equal(nombreApres(texte, passif.provenance.phraseCumul, quoi),
        passif.parCumul[index], quoi + " : pas mal transcrit.");
      assert.equal(passif.parCumul[index] * passif.cumuls, passif.niveaux[index],
        quoi + " : plafond different du pas x cumuls.");
    });
  });
});

assert.ok(lignes > 0, "la table est vide : ce test ne prouverait rien.");

/* Le contrat pur repose sur le fichier equipe et le niveau de son passif, pas
   sur le type d'arme : les douze autres gantelets de Derieri ne le portent pas. */
{
  const source = fs.readFileSync(
    path.join(racine, "js", "metier", "passifs-armes.js"), "utf8"
  ).replace(/^\s*export\s*\{[\s\S]*?\}\s*;\s*$/m, "");
  const bac = { window:{ SEVEN_DS_PASSIFS_ARMES:TABLE } };
  vm.runInNewContext(source, bac, { filename:"passifs-armes.js" });
  const resolve = bac.passifsArmesApplicables;
  assert.equal(typeof resolve, "function",
    "passifsArmesApplicables doit etre exposee par le module pur.");

  const fichier = Object.keys(TABLE)[0];
  const niveauSept = resolve({ fichier, niveau:7 });
  assert.equal(niveauSept.length, 1, "le bon fichier doit rendre son passif.");
  assert.equal(niveauSept[0].parCumul, 250,
    "le niveau 7 doit rendre +2,5 % par cumul.");
  assert.equal(niveauSept[0].valeur, 10000,
    "le niveau 7 doit rendre +100 % au plafond.");
  assert.equal(resolve({ fichier, niveau:null })[0].valeur, 3200,
    "un niveau absent replie sur le niveau 1, sans flatter le resultat.");
  assert.equal(resolve({ fichier:"7ds-armes/Gantelets/inconnus.webp", niveau:7 }).length, 0,
    "un autre gantelet ne doit jamais recevoir le passif de l'ame vorace.");
}

/* Le bonus est un taux de TOUTE l'attaque elementaire. Le laisser passer par
   entreesDuCalcul le rendrait inerte, car cette somme est deja resolue. */
{
  const { loadApp } = require("./helpers/load-app");
  const { statsElementairesDuBuild } = loadApp().hooks;
  const lire = code => ({ Dark_Add:5281, AllElement_Add:270 })[code] || 0;
  const fichier = Object.keys(TABLE)[0];
  const tauxPassif = TABLE[fichier][0].parCumul[6] * 4;
  const sortie = statsElementairesDuBuild(lire, "dark", tauxPassif);
  assert.equal(sortie.attaqueElementaire, 6106.1,
    "le taux de tous les elements doit majorer les deux attaques elementaires.");
}

console.log("passifs-armes.test.js OK (" + lignes + " ligne(s))");
