const fs = require('fs');
const DEPOT = 'c:/Users/yanni/Desktop/Site Confrérie 7ds';
const LOC = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json';

const textes = JSON.parse(fs.readFileSync(LOC, 'utf8')).client_language_table;

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
function base(s) {
  return String(s)
    .replace(BALISE, '')
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/[’']/g, "'")
    .toLowerCase();
}
// Neutralise ce qui differe entre les deux sources : parametres du jeu d un
// cote, valeurs deja substituees de l autre.
function squelette(s) {
  return base(s)
    .replace(/\{\d+\}/g, ' ')
    .replace(/[\d.,]+\s*%/g, ' ')
    .replace(/[\d.,]+\s*s\b/g, ' ')
    .replace(/[\d.,]+/g, ' ')
    .replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, ' ')
    // le « s » de secondes survit d un cote et pas de l autre : on ecarte
    // toutes les lettres isolees
    .replace(/(^| )[a-z]( |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const corpus = Object.entries(textes).map(([cle, v]) => [cle, squelette(v)]);

global.window = {};
require(DEPOT + '/data/buffs-supports.js');
const parHeros = global.window.SEVEN_DS_BUFFS_SUPPORTS;

let total = 0, trouves = 0;
const absents = [], correspondances = [];
for (const [heros, liste] of Object.entries(parHeros)) {
  for (const b of liste) {
    const phrase = b.provenance && b.provenance.phrase;
    if (!phrase) continue;
    total++;
    const cible = squelette(phrase);
    if (cible.split(' ').length < 3) { continue; }
    const trouve = corpus.find(([, v]) => v.includes(cible));
    if (trouve) { trouves++; correspondances.push([b.provenance.gameId, trouve[0]]); }
    else absents.push({ heros, id: b.id, gameId: b.provenance.gameId, phrase, cible });
  }
}

console.log('phrases citees :', total);
console.log('retrouvees dans le texte du jeu :', trouves);
console.log('introuvables :', absents.length);

console.log('\n=== correspondance gameId -> cle de localisation ===');
const suffixes = {};
for (const [gid, cle] of correspondances) {
  const sg = String(gid).split('_').slice(2).join('_');
  const sc = String(cle).replace(/^local_skill_/, '').split('_').slice(2).join('_');
  const k = sg + '  ->  ' + sc;
  suffixes[k] = (suffixes[k] || 0) + 1;
}
Object.entries(suffixes).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('  ' + String(n).padStart(3), k));

if (absents.length) {
  console.log('\n=== phrases toujours introuvables ===');
  absents.forEach(a => {
    console.log('  ' + a.heros + ' / ' + a.id + '  (' + a.gameId + ')');
    console.log('      ' + JSON.stringify(a.phrase));
  });
}
