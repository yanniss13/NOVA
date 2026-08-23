// Confronte les phrases citees par un fichier de data/ au texte francais du jeu.
const fs = require('fs');
const DEPOT = 'c:/Users/yanni/Desktop/Site Confrérie 7ds';
const textes = JSON.parse(fs.readFileSync('C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json', 'utf8')).client_language_table;

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
function squelette(s) {
  return String(s)
    .replace(BALISE, '')
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .replace(/\{\d+\}/g, ' ')
    .replace(/[\d.,]+\s*%/g, ' ')
    .replace(/[\d.,]+/g, ' ')
    .replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, ' ')
    .replace(/(^| )[a-z]( |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const corpus = Object.entries(textes).map(([c, v]) => [c, squelette(v)]);

function phrases(objet, chemin = [], sortie = []) {
  if (!objet || typeof objet !== 'object') return sortie;
  if (Array.isArray(objet)) { objet.forEach((x, i) => phrases(x, chemin.concat(i), sortie)); return sortie; }
  if (objet.provenance && objet.provenance.phrase) {
    sortie.push({ id: objet.id || chemin.join('.'), phrase: objet.provenance.phrase, gameId: objet.provenance.gameId || '' });
  }
  for (const [k, v] of Object.entries(objet)) if (v && typeof v === 'object') phrases(v, chemin.concat(k), sortie);
  return sortie;
}

for (const fichier of process.argv.slice(2)) {
  global.window = {};
  require(DEPOT + '/data/' + fichier);
  const expose = Object.keys(global.window)[0];
  const liste = phrases(global.window[expose]);
  let ok = 0; const ko = [];
  for (const p of liste) {
    const cible = squelette(p.phrase);
    if (cible.split(' ').length < 3) { ok++; continue; }
    if (corpus.some(([, v]) => v.includes(cible))) ok++;
    else ko.push(p);
  }
  console.log('\n' + fichier + '  (' + expose + ')');
  console.log('  phrases citees : ' + liste.length + ' | confirmees : ' + ok + ' | introuvables : ' + ko.length);
  ko.slice(0, 8).forEach(p => console.log('     ' + p.id + (p.gameId ? ' [' + p.gameId + ']' : '') + ' : ' + JSON.stringify(p.phrase).slice(0, 110)));
}
