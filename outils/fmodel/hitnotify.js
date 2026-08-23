const fs = require('fs');
const path = require('path');
const D = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/TextDatas/CData/HitNotify';

const fichiers = fs.readdirSync(D).filter(f => f.endsWith('.json'));
console.log('fichiers :', fichiers.length);

const entrees = {};
const champs = {};
for (const f of fichiers) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); } catch (e) { continue; }
  for (const k of Object.keys(j)) champs[k] = (champs[k] || 0) + 1;
  entrees[String(j.ID || f.replace(/\.json$/, '')).toLowerCase()] = j;
}
console.log('entrees lues :', Object.keys(entrees).length);
console.log('\nchamps rencontres :');
Object.entries(champs).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('  ' + String(n).padStart(5), k));

console.log('\n=== exemples d auto-attaques ===');
for (const id of ['tristan_sworddual_normalatk_1', 'tristan_sworddual_normalatk_4', 'bug_axe_normalatk_1', 'diane_axe_normalatk_1']) {
  const e = entrees[id];
  console.log('  ' + id.padEnd(34), e ? JSON.stringify(e) : 'ABSENT');
}
