const actions = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/temps-action.json').actions;

// regroupe les variantes par action de base
const familles = {};
for (const [id, v] of Object.entries(actions)) {
  const m = /^grade_(\d+)_(.+)$/.exec(id);
  if (!m) continue;
  const base = m[2];
  (familles[base] || (familles[base] = [])).push({ grade: Number(m[1]), duree: v.duree, impacts: (v.impacts || []).length });
}

console.log('actions ayant des variantes de grade :', Object.keys(familles).length);

// 1. sur quels types d action portent-elles ?
const types = {};
for (const base of Object.keys(familles)) {
  const t = /charge/i.test(base) ? 'charge explicite'
    : /_ready$/i.test(base) ? 'ready (maintien)'
    : /_rmb/i.test(base) ? 'competence RMB'
    : /normalatk/i.test(base) ? 'auto-attaque'
    : /jumpatk/i.test(base) ? 'attaque sautee'
    : /skill_/i.test(base) ? 'autre competence'
    : 'autre';
  types[t] = (types[t] || 0) + 1;
}
console.log('\ntypes d action portant des grades :');
Object.entries(types).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log('  ' + String(n).padStart(4), t));

// 2. la duree croit-elle avec le grade ?
let croissantes = 0, decroissantes = 0, plates = 0, irregulieres = 0;
const exemples = [];
for (const [base, liste] of Object.entries(familles)) {
  if (liste.length < 3) continue;
  liste.sort((a, b) => a.grade - b.grade);
  const d = liste.map(x => x.duree);
  const toutesEgales = d.every(x => Math.abs(x - d[0]) <= 0.002);
  if (toutesEgales) { plates++; continue; }
  let monteSeulement = true, descendSeulement = true;
  for (let i = 1; i < d.length; i++) {
    if (d[i] < d[i - 1] - 0.002) monteSeulement = false;
    if (d[i] > d[i - 1] + 0.002) descendSeulement = false;
  }
  if (monteSeulement) { croissantes++; if (exemples.length < 6) exemples.push(base + ' : ' + liste.map(x => 'g' + x.grade + '=' + x.duree).join('  ')); }
  else if (descendSeulement) decroissantes++;
  else { irregulieres++; if (exemples.length < 10) exemples.push('[IRREGULIER] ' + base + ' : ' + liste.map(x => 'g' + x.grade + '=' + x.duree).join('  ')); }
}
console.log('\nfamilles d au moins 3 grades :');
console.log('  duree strictement croissante :', croissantes);
console.log('  duree strictement decroissante :', decroissantes);
console.log('  duree constante :', plates);
console.log('  irreguliere :', irregulieres);
console.log('\nexemples :');
exemples.forEach(e => console.log('   ', e));

// 3. les grades presents forment-ils une suite continue ?
const suites = {};
for (const liste of Object.values(familles)) {
  const g = liste.map(x => x.grade).sort((a, b) => a - b).join(',');
  suites[g] = (suites[g] || 0) + 1;
}
console.log('\nsuites de grades les plus frequentes :');
Object.entries(suites).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([g, n]) => console.log('  ' + String(n).padStart(4), '[' + g + ']'));
