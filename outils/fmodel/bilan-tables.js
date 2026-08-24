const fs = require('fs');
const path = require('path');
const RACINE = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table';

function parcours(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) parcours(f, out);
    else if (f.endsWith('.json')) out.push(f);
  }
  return out;
}

const fichiers = parcours(RACINE);
const lues = [], vides = [];
for (const f of fichiers) {
  const rel = path.relative(RACINE, f).split(path.sep).join('/');
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const n = Object.keys(j[0].Rows || {}).length;
    if (n > 0) lues.push([rel, n]); else vides.push(rel);
  } catch (e) { vides.push(rel + ' (illisible)'); }
}
console.log('tables lues :', lues.length, '| vides :', vides.length, '| total :', fichiers.length);
console.log('--- 20 plus grosses tables lues ---');
lues.sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([f, n]) => console.log(String(n).padStart(7), f));
console.log('--- tables vides qui nous interessent ---');
const cibles = /Actor\/(HeroActorTable|StatInfoTable|StatInfoGroupTable)|Buff\/BuffTable|Skill\/|Item\/ItemTable/;
vides.filter(v => cibles.test(v)).forEach(v => console.log('   ', v));
