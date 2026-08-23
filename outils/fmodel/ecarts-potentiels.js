const fs = require('fs');
const textes = JSON.parse(fs.readFileSync('C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
const nettoyer = (s) => String(s).replace(BALISE, '').replace(/[\u00A0\u202F\u2009]/g, ' ').replace(/\s+/g, ' ').trim();
function mots(s) {
  return new Set(nettoyer(s).toLowerCase()
    .replace(/\{\d+\}/g, ' ').replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, ' ')
    .split(/\s+/).filter(m => m.length > 3));
}

const jeu = new Map();
for (const [cle, v] of Object.entries(textes)) {
  const m = /^local_skill_(.+?)_potential_(\d+)_desc$/.exec(cle);
  if (m) jeu.set(m[1].toLowerCase().replace(/_/g, '') + '|' + m[2], { cle, texte: v });
}

const reformulations = [], differents = [];
for (const p of site) {
  for (const pot of p.potentials || []) {
    const k = (p.slug + pot.weaponType).toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + pot.tier;
    const g = jeu.get(k);
    if (!g) continue;
    const a = mots(pot.bonusFr), b = mots(g.texte);
    if (!a.size || !b.size) continue;
    let communs = 0;
    for (const m of a) if (b.has(m)) communs++;
    const jaccard = communs / (a.size + b.size - communs);
    const entree = { heros: p.nameFr, slug: p.slug, arme: pot.weaponType, tier: pot.tier, jaccard, site: nettoyer(pot.bonusFr), jeu: nettoyer(g.texte) };
    if (jaccard >= 0.75) continue;                 // identique ou quasi
    if (jaccard >= 0.4) reformulations.push(entree);
    else differents.push(entree);
  }
}

differents.sort((x, y) => x.jaccard - y.jaccard);
console.log('reformulations de traduction (recouvrement 40-75 %) :', reformulations.length);
console.log('effets REELLEMENT differents (recouvrement < 40 %)  :', differents.length);
console.log('\n=== les potentiels dont le site decrit autre chose que le jeu ===');
for (const d of differents) {
  console.log('\n' + d.heros + ' / ' + d.arme + ' p' + d.tier + '   (recouvrement ' + Math.round(d.jaccard * 100) + ' %)');
  console.log('  site : ' + d.site.slice(0, 160));
  console.log('  jeu  : ' + d.jeu.slice(0, 160));
}
console.log('\n=== reformulations (meme sens, traduction revue) ===');
reformulations.slice(0, 5).forEach(d => console.log('  ' + d.heros + ' / ' + d.arme + ' p' + d.tier + ' — recouvrement ' + Math.round(d.jaccard * 100) + ' %'));
