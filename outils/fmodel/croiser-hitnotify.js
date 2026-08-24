const fs = require('fs');
const path = require('path');
const D = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/TextDatas/CData/HitNotify';
const DEPOT = 'c:/Users/yanni/Desktop/Site Confrérie 7ds';

const table = {};
for (const f of fs.readdirSync(D).filter(x => x.endsWith('.json'))) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
    table[String(j.ID || '').toLowerCase()] = j;
  } catch (e) { /* ignore */ }
}

const mesAnims = JSON.parse(fs.readFileSync(DEPOT + '/data/animations-extraites.json', 'utf8')).animations;
const aplati = (h) => (h || []).flat().map(x => Math.round(Number(x) * 1000) / 1000);

// --- 1. mes marqueurs EHit contre le HitList du jeu ---
let identiques = 0, differents = 0, absents = 0;
const ecarts = [];
for (const [cle, v] of Object.entries(mesAnims)) {
  const t = table[cle];
  if (!t) { absents++; continue; }
  const jeu = aplati(t.HitList).sort((a, b) => a - b);
  const moi = (v.impacts || []).slice().sort((a, b) => a - b);
  const memeNombre = jeu.length === moi.length;
  const memesValeurs = memeNombre && jeu.every((x, i) => Math.abs(x - moi[i]) <= 0.002);
  if (memesValeurs) identiques++;
  else {
    differents++;
    if (ecarts.length < 10) ecarts.push(cle + ' : moi ' + JSON.stringify(moi) + '  jeu ' + JSON.stringify(jeu));
  }
}
console.log('=== mes marqueurs EHit contre HitList ===');
console.log('identiques :', identiques, '| differents :', differents, '| sans entree dans la table :', absents);
ecarts.forEach(e => console.log('   ', e));

// --- 2. duree : SequenceLength contre TotalTime ---
let dOk = 0, dKo = 0;
for (const [cle, v] of Object.entries(mesAnims)) {
  const t = table[cle];
  if (!t || v.duree === null) continue;
  if (Math.abs(Number(t.TotalTime) - v.duree) <= 0.002) dOk++; else dKo++;
}
console.log('\n=== duree : SequenceLength contre TotalTime ===');
console.log('identiques :', dOk, '| differentes :', dKo);

// --- 3. le champ `coups` du depot contre le nombre d applications du jeu ---
const src = fs.readFileSync(DEPOT + '/data/competences.js', 'utf8');
const parSlug = JSON.parse(src.replace(/^[\s\S]*?window\.SEVEN_DS_COMPETENCES = /, '').replace(/;\s*$/, ''));
let cOk = 0, cKo = 0, cAbs = 0;
const cEcarts = [];
for (const liste of Object.values(parSlug)) {
  for (const c of liste) {
    if (typeof c.coups !== 'number') continue;
    const t = table[String(c.gameId || '').toLowerCase()];
    if (!t) { cAbs++; continue; }
    const n = aplati(t.HitList).length;
    if (n === c.coups) cOk++;
    else { cKo++; if (cEcarts.length < 12) cEcarts.push(c.gameId + ' : site ' + c.coups + ' coups, jeu ' + n + ' applications'); }
  }
}
console.log('\n=== `coups` du depot contre le nombre d applications ===');
console.log('identiques :', cOk, '| differents :', cKo, '| sans entree :', cAbs);
cEcarts.forEach(e => console.log('   ', e));
