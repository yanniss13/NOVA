/* Confronte les potentiels du site a la SOURCE officielle du jeu.

   La verification precedente (verifier-potentiels.js) devinait la cle de
   localisation : `local_skill_<heros>_<arme>_potential_<n>_desc`. Cette cle
   existe, mais le jeu ne s'en sert pas toujours. La vraie chaine affichee est
   designee par le champ `Local_Key` de la ligne `<heros>_<arme>_grade_<n>` de
   `Table/Skill/DefaultSkillWeaponTypeTable`, et ses trous {0} {1} {2} sont
   bouches par `Local_Replace`. Beaucoup de paliers pointent vers un gabarit
   COMMUN (`Local_Skill_Common_Potential_NormalSkill_Rate`), que la cle devinee
   ne pouvait pas trouver.

   Lancer : node outils/fmodel/potentiels-officiels.js
*/
const fs = require('fs');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';
const RACINE = 'c:/Users/yanni/Desktop/Site Confrérie 7ds';

const textes = JSON.parse(fs.readFileSync(EXPORTS + '/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const parCleBasse = new Map();
for (const [k, v] of Object.entries(textes)) parCleBasse.set(k.toLowerCase(), v);

const table = JSON.parse(fs.readFileSync(EXPORTS + '/Table/Skill/DefaultSkillWeaponTypeTable.json', 'utf8'))[0].Rows;
const site = require(RACINE + '/7ds-stats/personnages.json');

/* Bouche les trous : Local_Replace liste des "{0}:{120%}". */
function substituer(texte, remplacements) {
  let sortie = texte;
  for (const brut of remplacements || []) {
    const m = /^\{(\d+)\}:\{(.*)\}$/.exec(String(brut));
    if (!m) continue;
    sortie = sortie.split('{' + m[1] + '}').join(m[2]);
  }
  return sortie;
}

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
function squelette(s, avecNombres) {
  let t = String(s)
    .replace(BALISE, '')
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/[’']/g, "'")
    .toLowerCase();
  /* Le jeu ecrit « 40 s », le site « 40s ». C'est de la typographie, pas une
     donnee : on rapproche les deux avant toute comparaison. */
  t = t.replace(/(\d)\s+s(?![a-z])/g, '$1s');
  if (!avecNombres) t = t.replace(/[\d.,]+\s*%?/g, ' ');
  return t
    .replace(/[^a-z0-9%àâçéèêëîïôûùüÿñæœ ]/g, ' ')
    .replace(/(^| )[a-z]( |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Les deux catalogues n'orthographient pas les heros pareil : le site ecrit
   « gil-thunder » et « mannie », le jeu « gil_thunder » et « manny ». */
const ALIAS = { manny: 'mannie' };
function normaliser(nom) {
  const n = String(nom).toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALIAS[n] || n;
}

/* Cote jeu : une entree par heros_arme_palier. */
const jeu = new Map();
let sansCle = 0, cleIntrouvable = 0;
for (const [ligne, v] of Object.entries(table)) {
  const m = /^(.+)_grade_(\d+)$/.exec(ligne);
  if (!m) continue;
  const prefixe = m[1], palier = Number(m[2]);
  const coupe = prefixe.lastIndexOf('_');
  const heros = prefixe.slice(0, coupe), arme = prefixe.slice(coupe + 1);
  const cle = v.Local_Key;
  if (!cle || cle === 'None') { sansCle++; continue; }
  const gabarit = parCleBasse.get(String(cle).toLowerCase());
  if (gabarit === undefined) { cleIntrouvable++; continue; }
  jeu.set(normaliser(heros) + '|' + arme + '|' + palier, {
    ligne, cle, gabarit,
    texte: substituer(gabarit, v.Local_Replace),
    remplacements: v.Local_Replace || [],
  });
}

console.log('paliers grade_N du jeu       :', jeu.size);
console.log('  sans Local_Key             :', sansCle);
console.log('  Local_Key absente du fr    :', cleIntrouvable);

/* Cote site. */
const bilan = { compares: 0, exact: 0, motsSeuls: 0, divergents: 0, sansJeu: 0 };
const ecarts = [], chiffres = [], introuvables = [];
for (const h of site) {
  for (const pot of h.potentials || []) {
    const slug = normaliser(h.slug);
    const cle = slug + '|' + String(pot.weaponType).toLowerCase() + '|' + pot.tier;
    const g = jeu.get(cle);
    if (!g) { bilan.sansJeu++; introuvables.push(cle); continue; }
    bilan.compares++;
    const aN = squelette(pot.bonusFr, true), bN = squelette(g.texte, true);
    if (aN === bN) { bilan.exact++; continue; }
    const a = squelette(pot.bonusFr, false), b = squelette(g.texte, false);
    if (a === b || a.includes(b) || b.includes(a)) {
      bilan.motsSeuls++;
      chiffres.push({ cle, site: pot.bonusFr, jeu: g.texte, source: g.cle });
    } else {
      bilan.divergents++;
      ecarts.push({ cle, site: pot.bonusFr, jeu: g.texte, source: g.cle });
    }
  }
}

console.log('\npaliers du site confrontes   :', bilan.compares);
console.log('  texte ET chiffres exacts   :', bilan.exact);
console.log('  memes mots, chiffre different :', bilan.motsSeuls);
console.log('  texte divergent            :', bilan.divergents);
console.log('  absents du jeu             :', bilan.sansJeu);

if (process.argv.includes('--detail')) {
  const montrer = (titre, liste) => {
    console.log('\n===== ' + titre + ' (' + liste.length + ') =====');
    for (const e of liste) {
      console.log('\n' + e.cle + '   <- ' + e.source);
      console.log('  site : ' + String(e.site).replace(BALISE, ''));
      console.log('  jeu  : ' + String(e.jeu).replace(BALISE, ''));
    }
  };
  montrer('CHIFFRE DIFFERENT', chiffres);
  montrer('TEXTE DIVERGENT', ecarts);
  if (introuvables.length) console.log('\nabsents du jeu : ' + introuvables.slice(0, 40).join(', '));
}
