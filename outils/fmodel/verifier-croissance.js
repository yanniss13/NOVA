const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const lire = (f) => JSON.parse(fs.readFileSync(T + f, 'utf8'))[0].Rows;
const armes = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/armes.json');

// --- depassement de limite ---
const over = lire('Item/ItemTable_Growth_Overlimit.json');
console.log('=== depassement de limite ===');
console.log('colonnes :', Object.keys(Object.values(over)[0]).join(', '));
const empJeu = new Set();
for (const r of Object.values(over)) {
  const mats = (r.NeedItem || []).map(x => x.Item_ID + 'x' + x.Count).sort().join(',');
  empJeu.add([r.OverLimitLevel !== undefined ? r.OverLimitLevel : r.Level, r.Cost, mats].join('|'));
}
let tot = 0, ok = 0; const rates = [];
for (const a of armes) for (const g of a.grades || []) {
  const l = g.overlimit && g.overlimit.levels ? g.overlimit.levels : [];
  for (const n of l) {
    tot++;
    const mats = '';
    const e = [n.level, n.gold !== undefined ? n.gold : n.goldCost, mats].join('|');
    if (empJeu.has(e)) ok++; else if (rates.length < 4) rates.push(JSON.stringify(n).slice(0, 140));
  }
}
console.log('paliers cites par le site :', tot, '| empreinte simple retrouvee :', ok);
if (rates.length) { console.log('exemple de palier du site :'); rates.forEach(r => console.log('   ' + r)); }
console.log('exemple de ligne du jeu :', JSON.stringify(Object.values(over)[1]).slice(0, 220));

// --- croissance par niveau ---
const lv = lire('Item/ItemTable_Growth_Lv.json');
console.log('\n=== croissance par niveau ===');
console.log('lignes :', Object.keys(lv).length, '| colonnes :', Object.keys(Object.values(lv)[0]).join(', '));
console.log('exemple :', JSON.stringify(Object.values(lv)[0]).slice(0, 240));
const g0 = armes[0].grades[0];
console.log('site, mainStatValues :', JSON.stringify(g0.mainStatValues));
console.log('site, subStatValues  :', JSON.stringify(g0.subStatValues).slice(0, 160));
