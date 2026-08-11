"use strict";

/* Les passifs d'arme sont transcrits depuis les sept niveaux publies par le
   jeu. Ce test tient lieu de GENERATEUR : il relit chaque chiffre dans le
   texte de CHAQUE fichier que la famille declare, niveau par niveau.

   Il protege quatre erreurs distinctes : un mauvais chiffre, une ancre qui
   viserait la mauvaise phrase du passif, un code de stat que personne ne lit,
   et une famille qui rassemblerait des armes dont les textes different. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EFFETS_SUR_LA_CIBLE } = require("./helpers/effets-cible");

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
  /* Arrondi OBLIGATOIRE : le jeu publie des pourcentages a une decimale, et
     2.2 x 100 vaut 220.00000000000003 en binaire. Sans lui, une transcription
     juste echouerait sur un chiffre impair - 2,5 % passait, 2,2 % non. Un
     pourcentage a deux decimales tombe toujours sur un dix-millieme entier,
     donc l'arrondi ne peut masquer aucune valeur reelle. */
  return Math.round(Number(trouve[1]) * 100);
}

const TABLE = catalogueDe("passifs-armes.js", "SEVEN_DS_PASSIFS_ARMES");
const BUILD = catalogueDe("stats-build.js", "SEVEN_DS_BUILD_STATS");

/* Les fichiers que le ROSTER peut reellement poser dans `hero.weapon`.
   Exister dans le catalogue de statistiques ne suffit pas : c'est data.js qui
   remplit le selecteur d'arme, et une variante d'accent entre les deux
   listes rendrait le passif introuvable sans qu'aucun chiffre ne soit faux. */
const ARMES_DU_ROSTER = new Set(
  Object.values(catalogueDe("data.js", "SEVEN_DS_DATA").armes)
    .flatMap(liste => liste.map(item => item.file))
);

assert.ok(Array.isArray(TABLE), "la table doit etre une liste de familles.");

const identifiants = new Set();
const fichiersVus = new Set();
let lignes = 0;
let armes = 0;

TABLE.forEach(famille => {
  assert.ok(famille.famille, "chaque entree doit se nommer.");
  assert.ok(Array.isArray(famille.armes) && famille.armes.length,
    famille.famille + " : au moins une arme est attendue.");
  assert.ok(Array.isArray(famille.lignes) && famille.lignes.length,
    famille.famille + " : au moins une ligne est attendue.");

  famille.armes.forEach(fichier => {
    assert.ok(BUILD.weaponsByFile[fichier],
      "arme inconnue du catalogue : " + fichier);
    assert.ok(ARMES_DU_ROSTER.has(fichier),
      "arme absente de data.js, donc inequipable : " + fichier);
    /* Une arme dans deux familles recevrait deux fois le meme passif sans que
       rien ne le signale : le chiffre doublerait en silence. */
    assert.ok(!fichiersVus.has(fichier),
      "arme declaree dans deux familles : " + fichier);
    fichiersVus.add(fichier);
    armes++;
  });

  famille.lignes.forEach(ligne => {
    lignes++;
    assert.ok(!identifiants.has(ligne.id), "identifiant en double : " + ligne.id);
    identifiants.add(ligne.id);

    /* Une ligne porte SOIT un code de stat du heros, SOIT un effet sur la
       cible - jamais les deux, jamais aucun. Sans ce controle, une ligne sans
       cible resterait muette dans le calcul sans rien dire. */
    const aStat = Boolean(ligne.stat);
    const aEffet = Boolean(ligne.effet);
    assert.ok(aStat !== aEffet,
      ligne.id + " : une ligne porte un code de stat OU un effet, pas les deux.");
    if(aStat){
      assert.ok(BUILD.statLabels[ligne.stat],
        ligne.id + " : code de stat inconnu : " + ligne.stat);
    }else{
      assert.ok(EFFETS_SUR_LA_CIBLE.includes(ligne.effet),
        ligne.id + " : effet inconnu sur la cible : " + ligne.effet);
    }

    assert.ok(["add", "multiply"].includes(ligne.operation),
      ligne.id + " : operation attendue : add ou multiply.");
    assert.equal(ligne.unite, "ten-thousandths",
      ligne.id + " : les taux se stockent en dix-milliemes.");
    assert.equal(ligne.niveaux.length, 7,
      ligne.id + " : sept niveaux attendus.");
    /* Un taux sur l'attaque du heros DOIT multiplier : verse en `add`, il
       ajouterait 4 000 points d'attaque plate au lieu de 40 %. */
    if(ligne.stat === "I_AtkAdd_Rate"){
      assert.equal(ligne.operation, "multiply",
        ligne.id + " : un taux d'attaque multiplie, il ne s'ajoute pas.");
    }
    /* Le critique venu de l'ARME est celui du heros, donc plafonne a 90 %.
       Sans `porteur`, entreesDuCalcul le rangerait dans le seau des allies,
       qui echappe au plafond - et le build en sortirait trop fort. */
    if(ligne.stat === "C_Critical_Rate"){
      assert.equal(ligne.porteur, "hero",
        ligne.id + " : le critique d'une arme est celui du heros.");
    }

    /* Les trois champs de cumul voyagent ENSEMBLE. Un pas sans plafond, ou un
       plafond sans ancre, laisserait la vue derouler un selecteur qu'aucun
       texte publie ne justifie. */
    const aCumuls = ligne.parCumul !== undefined || ligne.cumuls !== undefined
      || ligne.provenance.phraseCumul !== undefined;
    if(aCumuls){
      assert.ok(Array.isArray(ligne.parCumul) && ligne.parCumul.length === 7,
        ligne.id + " : sept pas de cumul attendus.");
      assert.ok(ligne.cumuls, ligne.id + " : un plafond de cumuls est attendu.");
      assert.ok(ligne.provenance.phraseCumul,
        ligne.id + " : une ancre de pas est attendue.");
    }

    famille.armes.forEach(fichier => {
      BUILD.weaponsByFile[fichier].passiveLevels.forEach((niveau, index) => {
        const texte = texteNet(niveau.textFr);
        const quoi = ligne.id + " · " + fichier.split("/").pop()
          + " niveau " + niveau.level;
        assert.equal(nombreApres(texte, ligne.provenance.phrase, quoi),
          ligne.niveaux[index], quoi + " : valeur mal transcrite.");
        if(!aCumuls) return;
        const pas = Array.isArray(ligne.cumuls)
          ? ligne.cumuls[index] : ligne.cumuls;
        assert.equal(nombreApres(texte, ligne.provenance.phraseCumul, quoi),
          ligne.parCumul[index], quoi + " : pas mal transcrit.");
        assert.equal(ligne.parCumul[index] * pas, ligne.niveaux[index],
          quoi + " : plafond different du pas x cumuls.");
      });
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

  const vorace = "7ds-armes/Gantelets/Gantelets de l'âme vorace.webp";
  const niveauSept = resolve({ fichier:vorace, niveau:7 });
  assert.equal(niveauSept.length, 1, "le bon fichier doit rendre son passif.");
  assert.equal(niveauSept[0].parCumul, 250,
    "le niveau 7 doit rendre +2,5 % par cumul.");
  assert.equal(niveauSept[0].valeur, 10000,
    "le niveau 7 doit rendre +100 % au plafond.");
  assert.equal(resolve({ fichier:vorace, niveau:null })[0].valeur, 3200,
    "un niveau absent replie sur le niveau 1, sans flatter le resultat.");
  assert.equal(resolve({ fichier:"7ds-armes/Gantelets/inconnus.webp", niveau:7 }).length, 0,
    "un autre gantelet ne doit jamais recevoir le passif de l'ame vorace.");

  /* Une famille rend son passif a CHACUNE de ses armes, et les deux lignes
     d'une meme phrase arrivent ensemble. */
  const noires = resolve({
    fichier:"7ds-armes/Hache/Hache des ailes de la flamme noire.webp", niveau:7
  });
  assert.equal(noires.length, 2,
    "la famille des ailes porte deux lignes : attaque et critique.");
  /* Comparaison par chaine, jamais deepEqual : le tableau vient du bac `vm`,
     donc son Array.prototype n'est pas celui de ce module et l'egalite
     profonde echoue sur deux listes pourtant identiques. */
  assert.equal(noires.map(l => l.valeur).join("|"), "4000|1500",
    "les deux lignes rendent leur valeur de niveau 7.");
  /* Un passif sans cumuls ne doit rendre NI pas NI plafond : la vue s'en sert
     pour choisir entre une case et un selecteur. */
  assert.equal(noires[0].parCumul, null,
    "un passif sans cumuls ne rend pas de pas.");
  assert.equal(noires[0].cumuls, null,
    "un passif sans cumuls ne rend pas de plafond.");

  /* UN PLAFOND QUI CHANGE DE COMPTE SELON LE NIVEAU. La vue deroule son
     selecteur de zero a `cumuls` : rendre le tableau entier au lieu du nombre
     du niveau y afficherait une liste vide. */
  const aura = "7ds-armes/Hache/Hache à l'aura triomphale.webp";
  assert.equal(resolve({ fichier:aura, niveau:1 })[0].cumuls, 13,
    "l'aura triomphale plafonne a treize coups au niveau 1.");
  assert.equal(resolve({ fichier:aura, niveau:7 })[0].cumuls, 15,
    "elle plafonne a quinze coups au niveau 7.");
  assert.equal(resolve({ fichier:aura, niveau:7 })[0].parCumul, 220,
    "et rend +2,2 % par coup a ce niveau.");
}

/* CHAQUE LIGNE DOIT ATTEINDRE LE CALCUL, par l'une des deux routes.

   C'est le controle qui compte vraiment : une ligne parfaitement transcrite
   mais rangee du mauvais cote serait soit inerte, soit comptee deux fois, et
   aucune des assertions ci-dessus ne le verrait. Le test rejoue donc les deux
   trajets sur de vraies entrees. */
{
  const { loadApp } = require("./helpers/load-app");
  const {
    statsElementairesDuBuild, entreesDuCalcul, versLAttaqueElementaire,
    bonusCategorieDesBuffs
  } = loadApp().hooks;

  const source = fs.readFileSync(
    path.join(racine, "js", "metier", "passifs-armes.js"), "utf8"
  ).replace(/^\s*export\s*\{[\s\S]*?\}\s*;\s*$/m, "");
  const bac = { window:{ SEVEN_DS_PASSIFS_ARMES:TABLE } };
  vm.runInNewContext(source, bac, { filename:"passifs-armes.js" });
  const partage = bac.versLAttaqueElementaire;
  assert.equal(typeof partage, "function",
    "versLAttaqueElementaire doit etre exposee par le module pur.");
  assert.equal(typeof versLAttaqueElementaire, "function",
    "la vue doit pouvoir importer la meme regle de partage.");

  /* Route 1 — l'attaque elementaire, resolue AVANT les entrees. Le laisser
     passer par entreesDuCalcul le rendrait inerte : la somme y est deja faite. */
  const lire = code => ({ Dark_Add:5281, AllElement_Add:270 })[code] || 0;
  const barrage = TABLE.flatMap(f => f.lignes)
    .find(ligne => ligne.id === "gantelets-ame-vorace-barrage-tenebres");
  assert.ok(partage(barrage), "Barrage passe par l'attaque elementaire.");
  const sortie = statsElementairesDuBuild(lire, "dark", barrage.parCumul[6] * 4);
  assert.equal(sortie.attaqueElementaire, 6106.1,
    "le taux de tous les elements doit majorer les deux attaques elementaires.");

  /* Route 2 — les lignes cochees. Chacune doit deplacer soit une entree
     commune, soit un bonus de CATEGORIE : ces derniers ne passent pas par
     entreesDuCalcul, dont les seaux valent pour toutes les competences a la
     fois, et voyagent a part. Une ligne qui ne bouge ni l'un ni l'autre porte
     un code que personne ne lit, et sa case ne ferait rien. */
  const base = {
    atk:20000, attaqueElementaire:5000, critRate:4000, critDamage:12000,
    percementDefense:0
  };
  const nu = entreesDuCalcul({ statsDuBuild:base, buffsCoches:[] });
  let cochables = 0;
  TABLE.flatMap(f => f.lignes).filter(ligne => !partage(ligne))
    .forEach(ligne => {
      cochables++;
      const valuee = Object.assign({}, ligne, { valeur:ligne.niveaux[6] });
      const avec = entreesDuCalcul({ statsDuBuild:base, buffsCoches:[valuee] });
      const bougeEntree = Object.keys(nu).some(cle => nu[cle] !== avec[cle]);
      const bougeCategorie =
        Object.keys(bonusCategorieDesBuffs([valuee])).length > 0;
      assert.ok(bougeEntree || bougeCategorie,
        ligne.id + " : cochee, cette ligne ne change aucune entree du moteur.");
    });
  assert.ok(cochables >= 4,
    "les familles sans cumuls doivent emprunter la route des lignes cochees.");
}

console.log("passifs-armes.test.js OK (" + lignes + " ligne(s) sur "
  + armes + " armes)");
