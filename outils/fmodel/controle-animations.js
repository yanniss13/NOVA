const fs = require('fs');
const extrait = JSON.parse(fs.readFileSync(__dirname + '/animations-extraites.json', 'utf8')).animations;
const src = fs.readFileSync('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/competences.js', 'utf8');
const parSlug = JSON.parse(src.replace(/^[\s\S]*?window\.SEVEN_DS_COMPETENCES = /, '').replace(/;\s*$/, ''));
const competences = [];
for (const [slug, l] of Object.entries(parSlug)) for (const c of l) competences.push({ slug, ...c });

const entrees = Object.entries(extrait);
console.log('animations extraites :', entrees.length);
console.log('avec une duree       :', entrees.filter(([, v]) => v.duree !== null).length);
console.log('avec des impacts     :', entrees.filter(([, v]) => v.impacts.length).length);
console.log('avec des fenetres    :', entrees.filter(([, v]) => Object.keys(v.fenetres).length).length);

const dur = entrees.map(([, v]) => v.duree).filter(x => x !== null).sort((a, b) => a - b);
console.log('durees : min', dur[0], '| mediane', dur[Math.floor(dur.length / 2)], '| max', dur[dur.length - 1]);

const typesFenetre = {};
entrees.forEach(([, v]) => Object.keys(v.fenetres).forEach(k => { typesFenetre[k] = (typesFenetre[k] || 0) + 1; }));
console.log('\ntypes de fenetre :', Object.entries(typesFenetre).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' (' + n + ')').join(', '));

console.log('\n=== confrontation du nombre d impacts au champ `coups` ===');
let egal = 0, diff = 0, sansCoups = 0, sansImpact = 0;
const ecarts = [];
for (const c of competences) {
  const e = extrait[c.gameId];
  if (!e) continue;
  if (typeof c.coups !== 'number') { sansCoups++; continue; }
  if (!e.impacts.length) { sansImpact++; continue; }
  if (e.impacts.length === c.coups) egal++;
  else { diff++; ecarts.push({ id: c.gameId, nom: c.nom, coups: c.coups, impacts: e.impacts.length, rep: (c.repartition || []).length }); }
}
console.log('nombre identique      :', egal);
console.log('nombre different      :', diff);
console.log('`coups` absent        :', sansCoups);
console.log('aucun marqueur EHit   :', sansImpact);

console.log('\n--- 15 ecarts ---');
ecarts.slice(0, 15).forEach(e => console.log('  ', e.id.padEnd(34), 'site coups=' + String(e.coups).padStart(2), ' jeu EHit=' + String(e.impacts).padStart(2), ' repartition=' + e.rep));

console.log('\n--- exemple complet ---');
const ex = extrait['bug_axe_normalatk_1'] || extrait[Object.keys(extrait)[0]];
console.log(JSON.stringify(ex, null, 1));
