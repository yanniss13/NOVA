const fs = require('fs');
const textes = JSON.parse(fs.readFileSync('C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

global.window = {};
require('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/effets-dps.js');
const effets = global.window.SEVEN_DS_EFFETS_DPS;

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
const nettoyer = (s) => String(s).replace(BALISE, '').replace(/[\u00A0\u202F\u2009]/g, ' ').replace(/\s+/g, ' ').trim();
function mots(s) {
  return new Set(nettoyer(s).toLowerCase().replace(/\{\d+\}/g, ' ')
    .replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, ' ').split(/\s+/).filter(m => m.length > 3));
}

const jeu = new Map();
for (const [cle, v] of Object.entries(textes)) {
  const m = /^local_skill_(.+?)_potential_(\d+)_desc$/.exec(cle);
  if (m) jeu.set(m[1].toLowerCase().replace(/_/g, '') + '|' + m[2], v);
}

let modelises = 0, sansImpact = 0, absents = 0;
const touches = [];
for (const p of site) {
  for (const pot of p.potentials || []) {
    const k = (p.slug + pot.weaponType).toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + pot.tier;
    const g = jeu.get(k);
    if (!g) continue;
    const a = mots(pot.bonusFr), b = mots(g);
    if (!a.size || !b.size) continue;
    let c = 0; for (const m of a) if (b.has(m)) c++;
    if (c / (a.size + b.size - c) >= 0.4) continue;   // pas un ecart de fond

    const parArme = effets.heroes && effets.heroes[p.slug];
    const e = parArme && parArme[pot.weaponType] && parArme[pot.weaponType].potentials
      ? parArme[pot.weaponType].potentials[String(pot.tier)] : null;
    if (!e) { absents++; continue; }
    if (e.classification === 'modelise' && (e.regles || []).length) {
      modelises++;
      touches.push({ heros: p.nameFr, arme: pot.weaponType, tier: pot.tier, regles: e.regles, site: nettoyer(pot.bonusFr), jeu: nettoyer(g) });
    } else sansImpact++;
  }
}

console.log('potentiels au texte divergent :', modelises + sansImpact + absents);
console.log('  dont MODELISES dans le moteur de DPS :', modelises);
console.log('  dont classes sans impact             :', sansImpact);
console.log('  dont absents de effets-dps.js        :', absents);
console.log('\n=== ceux qui font vraiment bouger un chiffre ===');
for (const t of touches) {
  console.log('\n' + t.heros + ' / ' + t.arme + ' p' + t.tier);
  console.log('  regle appliquee : ' + JSON.stringify(t.regles));
  console.log('  texte du site   : ' + t.site.slice(0, 120));
  console.log('  texte du jeu    : ' + t.jeu.slice(0, 120));
}
