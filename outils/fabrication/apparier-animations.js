const fs = require('fs');
const CHEMINS = 'C:/Users/yanni/AppData/Local/Temp/claude/c--Users-yanni-Desktop-Site-Confr-rie-7ds/45d35359-c14e-46d1-b295-2f02368f85d3/scratchpad/tous-les-chemins.txt';

// gameIds du depot
const src = fs.readFileSync('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/competences.js', 'utf8');
const obj = JSON.parse(src.replace(/^[\s\S]*?window\.SEVEN_DS_COMPETENCES = /, '').replace(/;\s*$/, ''));
const competences = [];
for (const [slug, liste] of Object.entries(obj)) for (const c of liste) competences.push({ slug, ...c });
console.log('competences :', competences.length, '| heros :', Object.keys(obj).length);

// noms d animations du jeu, en minuscules
const noms = new Set();
const parNom = new Map();
for (const l of fs.readFileSync(CHEMINS, 'utf8').split('\n')) {
  const chemin = l.split('\t')[1];
  if (!chemin || !/Cha\/PC\/PC_[^/]+\/Ani\//i.test(chemin) || !chemin.endsWith('.uasset')) continue;
  const nom = chemin.split('/').pop().replace(/\.uasset$/, '');
  const cle = nom.toLowerCase();
  noms.add(cle);
  if (!parNom.has(cle)) parNom.set(cle, chemin);
}
console.log('animations de heros dans les paks :', noms.size);

let exact = 0, viaMtg = 0, absent = 0;
const manquants = [];
for (const c of competences) {
  const id = String(c.gameId || '').toLowerCase();
  if (!id) continue;
  if (noms.has(id)) { exact++; continue; }
  if (noms.has(id + '_mtg')) { viaMtg++; continue; }
  absent++;
  if (manquants.length < 20) manquants.push(c.slug + ' / ' + c.weaponType + ' / ' + id);
}
console.log('\ncorrespondance exacte      :', exact);
console.log('correspondance via _MTG    :', viaMtg);
console.log('sans animation trouvee     :', absent);
console.log('\n--- exemples sans correspondance ---');
manquants.forEach(m => console.log('  ', m));

// a quoi ressemblent les suffixes des gameIds
const suffixes = {};
for (const c of competences) {
  const p = String(c.gameId || '').split('_');
  const s = p.slice(2).join('_');
  suffixes[s] = (suffixes[s] || 0) + 1;
}
console.log('\n--- suffixes de gameId les plus frequents ---');
Object.entries(suffixes).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([s, n]) => console.log(String(n).padStart(4), s));
