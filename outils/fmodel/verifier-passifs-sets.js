const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const valeurs = JSON.parse(fs.readFileSync(T + 'Item/EquipSetOptionValueTable.json', 'utf8'))[0].Rows;
const textes = JSON.parse(fs.readFileSync('C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/sets.json');

global.window = {};
require('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/passifs-ensembles.js');
const cle = Object.keys(global.window)[0];
const passifsDepot = global.window[cle];
console.log('data/passifs-ensembles.js expose :', cle);
console.log('type :', Array.isArray(passifsDepot) ? 'tableau[' + passifsDepot.length + ']' : 'objet(' + Object.keys(passifsDepot).length + ')');

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
const net = (s) => String(s).replace(BALISE, '').replace(/[\u00A0\u202F\u2009]/g, ' ').replace(/\s+/g, ' ').trim();
const squelette = (s) => net(s).toLowerCase().replace(/\{\d+\}/g, ' ').replace(/[\d.,]+\s*%?/g, ' ')
  .replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, ' ').replace(/\s+/g, ' ').trim();

const parId = new Map(site.map(s => [String(s.gameId), s]));
let total = 0, dansLeTexte = 0, absents = 0;
const manquants = [];
for (const r of Object.values(valeurs)) {
  if (String(r.Option_Type) !== 'EItemOptionType::Passive') continue;
  total++;
  const s = parId.get(String(r.SetGroupTId));
  const texteJeu = textes[String(r.Local_Desc)];
  if (!s || texteJeu === undefined) { absents++; continue; }
  const champs = [s.bonusTwoFr, s.bonusFourFr, s.bonusSevenFr].filter(Boolean).map(squelette).join(' | ');
  const cible = squelette(texteJeu);
  if (cible && champs.includes(cible)) dansLeTexte++;
  else manquants.push({ set: s.nameFr, pieces: r.SetPartsCount, jeu: net(texteJeu), cle: r.Local_Desc });
}
console.log('\npassifs d ensemble publies par le jeu :', total);
console.log('  retrouves dans le texte du site :', dansLeTexte);
console.log('  introuvables :', manquants.length, '| sans correspondance :', absents);
manquants.slice(0, 10).forEach(m => {
  console.log('\n  ' + m.set + ' — ' + m.pieces + ' pieces  (' + m.cle + ')');
  console.log('     ' + m.jeu.slice(0, 140));
});
