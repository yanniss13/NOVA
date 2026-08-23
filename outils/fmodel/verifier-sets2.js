const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const table = (r) => JSON.parse(fs.readFileSync(T + r, 'utf8'))[0].Rows;
const textes = JSON.parse(fs.readFileSync('C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/sets.json');

const valeurs = table('Item/EquipSetOptionValueTable.json');
const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
const net = (s) => String(s).replace(BALISE, '').replace(/[\u00A0\u202F\u2009]/g, ' ').replace(/\s+/g, ' ').trim();
const squelette = (s) => net(s).toLowerCase().replace(/\{\d+\}/g, ' ').replace(/[\d.,]+\s*%?/g, ' ')
  .replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, ' ').replace(/\s+/g, ' ').trim();

// paliers du jeu : ensemble -> nb de pieces -> texte
const jeu = {};
for (const v of Object.values(valeurs)) {
  const g = String(v.SetGroupTId);
  (jeu[g] || (jeu[g] = {}))[v.SetPartsCount] = textes[String(v.Local_Desc)];
}

const parId = new Map(site.map(s => [String(s.gameId), s]));
let paliersJeu = 0, couverts = 0, manquants = 0, textesOk = 0, textesKo = 0;
const detailManquants = [], detailTextes = [];

for (const [id, paliers] of Object.entries(jeu)) {
  const s = parId.get(id);
  if (!s) continue;
  const duSite = {};
  for (const [champ, cnt] of [['bonusTwo', s.bonusTwoCount], ['bonusFour', s.bonusFourCount], ['bonusSeven', s.bonusSevenCount]]) {
    if (cnt) duSite[cnt] = s[champ + 'Fr'];
  }
  for (const [pieces, texteJeu] of Object.entries(paliers)) {
    paliersJeu++;
    const texteSite = duSite[pieces];
    if (texteSite === undefined) {
      manquants++;
      detailManquants.push({ id, nom: s.nameFr, pieces: Number(pieces), texte: net(texteJeu || '(sans texte)') });
      continue;
    }
    couverts++;
    const a = squelette(texteSite), b = squelette(texteJeu);
    if (a === b || a.includes(b) || b.includes(a)) textesOk++;
    else { textesKo++; detailTextes.push({ id, nom: s.nameFr, pieces, site: net(texteSite), jeu: net(texteJeu) }); }
  }
}

console.log('paliers publies par le jeu (sur les 22 ensembles du site) :', paliersJeu);
console.log('  couverts par le site :', couverts, '| absents du site :', manquants);
console.log('  textes concordants   :', textesOk, '| divergents :', textesKo);

console.log('\n=== paliers que le jeu publie et que le site n a pas ===');
const parPieces = {};
detailManquants.forEach(m => { parPieces[m.pieces] = (parPieces[m.pieces] || 0) + 1; });
console.log('repartition :', Object.entries(parPieces).sort((a, b) => a[0] - b[0]).map(([k, v]) => k + ' pieces : ' + v).join('  |  '));
detailManquants.slice(0, 14).forEach(m => console.log('  ' + String(m.pieces) + ' pieces  ' + m.nom.padEnd(30) + m.texte.slice(0, 70)));

if (detailTextes.length) {
  console.log('\n=== textes divergents ===');
  detailTextes.slice(0, 8).forEach(d => {
    console.log('  ' + d.nom + ' — ' + d.pieces + ' pieces');
    console.log('     site : ' + d.site.slice(0, 110));
    console.log('     jeu  : ' + d.jeu.slice(0, 110));
  });
}
