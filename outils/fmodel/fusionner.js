const fs = require('fs');
const path = require('path');
const D = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/TextDatas/CData/HitNotify';
const DEPOT = 'c:/Users/yanni/Desktop/Site Confrérie 7ds';

const arrondi = (n) => Math.round(Number(n) * 1000) / 1000;

// --- table officielle des temps d action ---
const officiel = [];
for (const f of fs.readdirSync(D).filter(x => x.endsWith('.json'))) {
  try { officiel.push(JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'))); } catch (e) { /* ignore */ }
}

// --- mes montages, indexes par nom de montage ---
const mesAnims = JSON.parse(fs.readFileSync(DEPOT + '/data/animations-extraites.json', 'utf8')).animations;
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
