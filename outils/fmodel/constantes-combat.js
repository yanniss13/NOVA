const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const rows = JSON.parse(fs.readFileSync(T + 'Misc/DefineTable.json', 'utf8'))[0].Rows;

const val = (r) => String(r.Type) === 'EDefineType::Number' ? r.NValue : JSON.stringify(r.SValue);
// Dans ces tables, 10000 vaut 100 %.
const pct = (n) => (typeof n === 'number' ? (n / 100).toFixed(2).replace(/\.00$/, '') + ' %' : '');

const GROUPES = [
  ['Plafonds et planchers du combat', /^battle_(max|min)_/],
  ['Critique', /critical/i],
  ['Precision, blocage, percement', /accuracy|block|pierce/i],
  ['Elements et faiblesse', /weakness|element|attribute/i],
  ['Distance et correction de degats', /damcorrection/i],
  ['Defense', /def(rate|_)|totaldef/i],
  ['JcJ', /pvp/i],
  ['Degats sur la duree', /dot|tick/i],
  ['Autres constantes de degats', /dam|dmg|atk/i],
];

const vus = new Set();
for (const [titre, motif] of GROUPES) {
  const lignes = Object.entries(rows).filter(([k]) => !vus.has(k) && motif.test(k));
  if (!lignes.length) continue;
  console.log('\n=== ' + titre + ' ===');
  for (const [k, r] of lignes.sort()) {
    vus.add(k);
    const v = val(r);
    const p = typeof r.NValue === 'number' && r.NValue >= 100 && String(r.Type) === 'EDefineType::Number' ? '  (' + pct(r.NValue) + ')' : '';
    console.log('  ' + k.padEnd(46) + String(v).padStart(10) + p);
  }
}
console.log('\nconstantes de combat listees :', vus.size, 'sur', Object.keys(rows).length, 'au total');
