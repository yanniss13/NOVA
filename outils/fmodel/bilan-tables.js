// Bilan de lisibilite d un export FModel de Content/Table.
//
// Piege corrige le 25 aout : ce dossier ne contient PAS que des DataTable.
// Table/Directing/ heberge ~650 assets OGDirecting_* (mise en scene) qui n ont
// aucune cle Rows sans etre pour autant en echec. Les compter comme "vides"
// faisait passer un export sain pour une regression massive.
//
// Trois categories, et une seule signale un probleme :
//   lues      DataTable avec des lignes
//   creuses   DataTable sans une seule ligne  <- a verifier dans le journal
//   hors-sujet  asset qui n est pas une DataTable
//
// Une DataTable creuse peut etre vraiment vide OU avoir echoue au decodage :
// les deux pesent 430 octets. Seul le journal tranche :
//   Output/Logs/FModel-Log-<date>.log  ->  "Could not read DataTable correctly"
const fs = require('fs');
const path = require('path');
// Un argument permet de viser une extraction archivee, pour comparer deux usmap :
//   node outils/fmodel/bilan-tables.js .../Exports-usmap-1.7/SevenDeadlySins/Content/Table
const RACINE = process.argv[2] ||
  'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table';

function parcours(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) parcours(f, out);
    else if (f.endsWith('.json')) out.push(f);
  }
  return out;
}

const fichiers = parcours(RACINE);
const lues = [], creuses = [], horsSujet = [], illisibles = [];

for (const f of fichiers) {
  const rel = path.relative(RACINE, f).split(path.sep).join('/');
  let objet;
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    objet = Array.isArray(j) ? j[0] : null;
  } catch (e) {
    illisibles.push(rel);
    continue;
  }
  if (!objet) { illisibles.push(rel); continue; }

  // Une DataTable se reconnait a sa cle Rows, meme vide.
  if (!Object.prototype.hasOwnProperty.call(objet, 'Rows')) {
    horsSujet.push([rel, objet.Type || '?']);
    continue;
  }
  const n = Object.keys(objet.Rows || {}).length;
  if (n > 0) lues.push([rel, n]); else creuses.push(rel);
}

const tables = lues.length + creuses.length;
console.log('fichiers exportes :', fichiers.length);
console.log('  DataTable lues     :', lues.length, '/', tables);
console.log('  DataTable creuses  :', creuses.length, '  <- a confronter au journal');
console.log('  pas des DataTable  :', horsSujet.length);
if (illisibles.length) console.log('  JSON illisibles    :', illisibles.length);

if (horsSujet.length) {
  const parType = new Map();
  for (const [, t] of horsSujet) parType.set(t, (parType.get(t) || 0) + 1);
  const top = [...parType].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('    dont', top.map(([t, n]) => n + ' ' + t).join(', '));
}

console.log('--- 20 plus grosses tables lues ---');
lues.sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([f, n]) => console.log(String(n).padStart(7), f));

console.log('--- tables creuses qui nous interessent ---');
const cibles = /Actor\/(HeroActorTable|StatInfoTable|StatInfoGroupTable)|Buff\/BuffTable|Skill\/|Item\/ItemTable/;
const guettees = creuses.filter(v => cibles.test(v));
if (guettees.length) guettees.forEach(v => console.log('   ', v));
else console.log('    aucune -- toutes nos cibles ont des lignes');
