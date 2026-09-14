const fs = require('fs');
const path = require('path');
const actions = JSON.parse(fs.readFileSync('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/temps-action.json', 'utf8')).actions;

const arrondi = (n) => Math.round(Number(n) * 1000) / 1000;

/* La table contient, pour une meme animation, des variantes prefixees
   `grade_1_` a `grade_10_` et quelques identifiants fautifs (`tristant_`).
   On ne garde que l entree de base : son identifiant doit valoir exactement
   <heros>_<arme>_normalatk_<n>. */
const cycles = {};
for (const [id, a] of Object.entries(actions)) {
  const m = /_normalatk_(\d+)$/i.exec(id);
  if (!m || !a.heros || !a.arme) continue;
  const attendu = (a.heros + '_' + a.arme + '_normalatk_' + m[1]).toLowerCase();
  if (id !== attendu) continue;
  const cle = a.heros + '|' + a.arme;
  (cycles[cle] || (cycles[cle] = [])).push({ n: Number(m[1]), id, ...a });
}

const resultats = [];
for (const [cle, liste] of Object.entries(cycles)) {
  liste.sort((x, y) => x.n - y.n);
  const [heros, arme] = cle.split('|');
  let brut = 0, enchaine = 0, sansFenetre = 0;
  for (const a of liste) {
    brut += a.duree;
    const f = a.fenetres && a.fenetres.normalAttack;
    if (f) enchaine += f.debut; else { enchaine += a.duree; sansFenetre++; }
  }
  resultats.push({
    heros, arme, coups: liste.length,
    brut: arrondi(brut), enchaine: arrondi(enchaine), sansFenetre,
    gain: brut ? Math.round((1 - enchaine / brut) * 100) : 0,
    fiable: sansFenetre === 0,
  });
}
resultats.sort((a, b) => a.enchaine - b.enchaine);

const fiables = resultats.filter(r => r.fiable);
console.log('cycles reconstitues :', resultats.length, '| entierement fiables :', fiables.length);
const e = fiables.map(r => r.enchaine).sort((a, b) => a - b);
console.log('cycle enchaine (fiables) : plus rapide', e[0], 's | median', e[Math.floor(e.length / 2)], 's | plus lent', e[e.length - 1], 's');
const dist = {};
resultats.forEach(r => { dist[r.coups] = (dist[r.coups] || 0) + 1; });
console.log('longueurs :', Object.entries(dist).sort().map(([k, v]) => k + ' coups : ' + v).join(' | '));

console.log('\nheros           arme          coups   brut(s)  enchaine(s)  gain');
for (const r of resultats) {
  console.log(
    r.heros.padEnd(15), r.arme.padEnd(13), String(r.coups).padStart(4),
    String(r.brut).padStart(9), String(r.enchaine).padStart(12), (r.gain + ' %').padStart(6),
    r.fiable ? '' : '  <- ' + r.sansFenetre + ' animation(s) sans fenetre'
  );
}

fs.writeFileSync(path.join(__dirname, 'cycles-auto-attaque.json'), JSON.stringify({
  _lisezmoi: [
    'Cycle d auto-attaque par heros et par arme, build 1.8.1.2.',
    'Durees issues de la table du jeu (TextDatas/CData/HitNotify).',
    'Fenetres d annulation issues des marqueurs des montages.',
    'brut     : somme des durees d animation.',
    'enchaine : somme des instants d ouverture de la fenetre `normalAttack`,',
    '           soit le temps du cycle si on enchaine au plus tot.',
    'fiable   : false si une animation du cycle n a pas de fenetre connue ;',
    '           sa duree brute est alors comptee, ce qui surestime le cycle.',
    'Non mesure en jeu.',
  ],
  _unite: 'secondes',
  _build: '1.8.1.2',
  cycles: resultats,
}, null, 1));
console.log('\necrit : cycles-auto-attaque.json');
