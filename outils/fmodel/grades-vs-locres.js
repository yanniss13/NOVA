const fs = require('fs');
const textes = JSON.parse(fs.readFileSync('C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const actions = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/temps-action.json').actions;

// 1. quels paliers de potentiel portent une description de competence ?
const potentiels = new Set();
for (const cle of Object.keys(textes)) {
  const m = /^local_skill_(.+?)_potential_(\d+)_desc$/.exec(cle);
  // la localisation ecrit `gilthunder`, la table des actions `gil_thunder`
  if (m) potentiels.add(m[1].toLowerCase().replace(/_/g, '') + '|' + m[2]);
}
console.log('descriptions de potentiel dans la localisation :', potentiels.size);
const parPalier = {};
for (const p of potentiels) { const n = p.split('|')[1]; parPalier[n] = (parPalier[n] || 0) + 1; }
console.log('par palier :', Object.entries(parPalier).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => 'p' + k + ':' + v).join('  '));

// 2. quels couples heros|arme|grade portent une variante d action ?
const grades = new Set();
for (const id of Object.keys(actions)) {
  const m = /^grade_(\d+)_(.+)$/.exec(id);
  if (!m) continue;
  const a = actions[id];
  if (!a.heros || !a.arme) continue;
  grades.add((a.heros + a.arme).toLowerCase().replace(/_/g, '') + '|' + m[1]);
}
console.log('couples heros/arme/grade dans la table des actions :', grades.size);

// 3. croisement
let dansLesDeux = 0, gradeSeul = 0, potentielSeul = 0;
const exGradeSeul = [], exPotentielSeul = [];
for (const g of grades) {
  if (potentiels.has(g)) dansLesDeux++;
  else { gradeSeul++; if (exGradeSeul.length < 8) exGradeSeul.push(g); }
}
for (const p of potentiels) {
  if (!grades.has(p)) { potentielSeul++; if (exPotentielSeul.length < 8) exPotentielSeul.push(p); }
}
console.log();
console.log('=== croisement ===');
console.log('present des deux cotes        :', dansLesDeux);
console.log('grade sans description        :', gradeSeul);
console.log('description sans grade        :', potentielSeul);
console.log('\ngrade sans description :', exGradeSeul.join(', '));
console.log('description sans grade :', exPotentielSeul.join(', '));
