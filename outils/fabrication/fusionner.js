const fs = require('fs');
const path = require('path');
const D = (process.env.DONNEES_JEU || '') + '/TextDatas/CData/HitNotify';
const DEPOT = require('path').resolve(__dirname, '..', '..');

const arrondi = (n) => Math.round(Number(n) * 1000) / 1000;

// --- table officielle des temps d action ---
const officiel = [];
for (const f of fs.readdirSync(D).filter(x => x.endsWith('.json'))) {
  try { officiel.push(JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'))); } catch (e) { /* ignore */ }
}

// --- mes montages, indexes par nom de montage ---
// Les montages viennent par defaut de l instantane commite. MONTAGES_JEU permet
// d en lire un plus recent, typiquement `animations-completes.json` ecrit par
// extraire-tout.js sur l export courant.
const MONTAGES = process.env.MONTAGES_JEU || path.join(__dirname, 'animations-extraites.json');
const mesAnims = JSON.parse(fs.readFileSync(MONTAGES, 'utf8')).animations;
const parMontage = new Map();
for (const v of Object.values(mesAnims)) {
  const nom = String(v.source || '').split('/').pop().replace(/\.json$/, '').toLowerCase();
  parMontage.set(nom, v);
  parMontage.set(String(v.animation).toLowerCase(), v);
  parMontage.set(String(v.animation).toLowerCase() + '_mtg', v);
}

// --- competences du depot ---
const src = fs.readFileSync(DEPOT + '/data/competences.js', 'utf8');
const parSlug = JSON.parse(src.replace(/^[\s\S]*?window\.SEVEN_DS_COMPETENCES = /, '').replace(/;\s*$/, ''));
const competences = new Map();
for (const [slug, liste] of Object.entries(parSlug)) {
  for (const c of liste) competences.set(String(c.gameId || '').toLowerCase(), { slug, nom: c.nom, coups: c.coups, weaponType: c.weaponType });
}

const sortie = {};
let avecFenetres = 0, avecCompetence = 0, dureeConfirmee = 0, dureeDivergente = 0;
const divergences = [];

for (const o of officiel) {
  const id = String(o.ID || '').toLowerCase();
  if (!id) continue;
  const montage = String(o.MontageName || '').toLowerCase();
  const mien = parMontage.get(montage) || parMontage.get(montage.replace(/_mtg$/, ''));
  const impacts = (o.HitList || []).flat().map(arrondi);

  const e = {
    montage: o.MontageName || null,
    duree: arrondi(o.TotalTime),
    action: arrondi(o.ActionSec),
    impacts,
  };
  if (o.SkipSec) e.skipSec = arrondi(o.SkipSec);
  if (o.SuperArmor !== undefined) e.superArmor = o.SuperArmor;
  if (o.CounterTiming !== undefined) e.contreTiming = o.CounterTiming;
  if ((o.FireList || []).length) e.tirs = (o.FireList || []).flat().map(arrondi);

  if (mien) {
    e.heros = mien.heros;
    e.arme = mien.arme;
    // Les fenetres viennent du montage. On ne les recopie que si la duree du
    // montage confirme celle de la table : sinon rien ne garantit qu on parle
    // de la meme animation, et une fenetre mal rattachee vaut moins que rien.
    const memeAnimation = Math.abs(mien.duree - e.duree) <= 0.002;
    if (memeAnimation) {
      dureeConfirmee++;
      if (Object.keys(mien.fenetres || {}).length) { e.fenetres = mien.fenetres; avecFenetres++; }
    } else {
      dureeDivergente++;
      e.montageNonConfirme = mien.duree;
      if (divergences.length < 8) divergences.push(id + ' : montage ' + mien.duree + ' s, table ' + e.duree + ' s');
    }
  }
  const c = competences.get(id);
  if (c) { e.nom = c.nom; e.heros = e.heros || c.slug; e.arme = e.arme || c.weaponType; e.coupsDepot = c.coups; avecCompetence++; }

  sortie[id] = e;
}

console.log('entrees de la table officielle :', Object.keys(sortie).length);
console.log('avec fenetres d annulation     :', avecFenetres);
console.log('rattachees a une competence    :', avecCompetence);
console.log('duree confirmee par le montage :', dureeConfirmee, '| divergente :', dureeDivergente);
divergences.forEach(d => console.log('   ', d));

// --seulement=<prefixe> : ne remplacer, dans data/temps-action.json, que les
// actions d UN heros (identifiant `<prefixe>_...` ou `grade_N_<prefixe>_...`).
// Les autres entrees restent octet pour octet celles du build d origine : un
// heros arrive apres coup ne doit pas faire deriver tout le fichier.
const seulement = (process.argv.find(a => a.startsWith('--seulement=')) || '').split('=')[1];
if (seulement) {
  if (!process.env.BUILD_JEU) throw new Error('BUILD_JEU doit nommer le build de l export lu');
  const cible = path.join(DEPOT, 'data', 'temps-action.json');
  const depot = JSON.parse(fs.readFileSync(cible, 'utf8'));
  const duHeros = new RegExp('^(grade_[0-9]+_)?' + seulement + '_', 'i');
  const avant = Object.keys(depot.actions).filter(id => duHeros.test(id)).length;
  for (const id of Object.keys(depot.actions)) if (duHeros.test(id)) delete depot.actions[id];
  const ajoutees = Object.keys(sortie).filter(id => duHeros.test(id));
  for (const id of ajoutees) depot.actions[id] = sortie[id];
  const note = 'Actions `' + seulement + '_*` : build ' + process.env.BUILD_JEU
    + ', ecrites par fusionner.js --seulement=' + seulement + '.';
  depot._lisezmoi = depot._lisezmoi.filter(l => !l.startsWith('Actions `' + seulement + '_*`')).concat(note);
  fs.writeFileSync(cible, JSON.stringify(depot, null, 1));
  console.log('data/temps-action.json : ' + seulement + ' ' + avant + ' -> ' + ajoutees.length
    + ' actions, dont ' + ajoutees.filter(id => sortie[id].fenetres).length + ' avec fenetres');
  process.exit(0);
}

fs.writeFileSync(path.join(__dirname, 'temps-action.json'), JSON.stringify({
  _lisezmoi: [
    'Temps d action du jeu, extraits de TextDatas/CData/HitNotify (build 1.8.1.2).',
    'C est la table du jeu lui-meme, pas une mesure ni une deduction.',
    'Cle : identifiant d action, identique au gameId de data/competences.js',
    '      quand la competence y figure.',
    'duree    : TotalTime, en secondes.',
    'action   : ActionSec.',
    'impacts  : HitList aplatie — instants d application des degats.',
    '           UNE APPLICATION N EST PAS UN COUP : une seule peut declencher',
    '           une attaque a 13 coups. Comparer a `coupsDepot` avec prudence.',
    'tirs     : FireList — instants de lancement de projectile.',
    'fenetres : instants d ouverture des fenetres d annulation, lus dans les',
    '           marqueurs du montage. Absent de la table officielle.',
    'La table couvre aussi les monstres et les PNJ, pas seulement les heros.',
  ],
  _unite: 'secondes',
  _build: '1.8.1.2',
  actions: sortie,
}, null, 1));
console.log('ecrit : temps-action.json');
