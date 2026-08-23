const fs = require('fs');
const textes = JSON.parse(fs.readFileSync('C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');
global.window = {};
require('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/effets-dps.js');
const effets = global.window.SEVEN_DS_EFFETS_DPS;

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
const nettoyer = (s) => String(s).replace(BALISE, '').replace(/[\u00A0\u202F\u2009]/g, ' ').replace(/\s+/g, ' ').trim();
const mots = (s) => new Set(nettoyer(s).toLowerCase().replace(/\{\d+\}/g, ' ')
  .replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, ' ').split(/\s+/).filter(m => m.length > 3));

const jeu = new Map();
for (const [cle, v] of Object.entries(textes)) {
  const m = /^local_skill_(.+?)_potential_(\d+)_desc$/.exec(cle);
  if (m) jeu.set(m[1].toLowerCase().replace(/_/g, '') + '|' + m[2], { cle, texte: v });
}

const lignes = [];
for (const p of site) {
  for (const pot of p.potentials || []) {
    const k = (p.slug + pot.weaponType).toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + pot.tier;
    const g = jeu.get(k);
    if (!g) continue;
    const a = mots(pot.bonusFr), b = mots(g.texte);
    if (!a.size || !b.size) continue;
    let c = 0; for (const m of a) if (b.has(m)) c++;
    const j = c / (a.size + b.size - c);
    if (j >= 0.4) continue;
    const pa = effets.heroes && effets.heroes[p.slug];
    const e = pa && pa[pot.weaponType] && pa[pot.weaponType].potentials ? pa[pot.weaponType].potentials[String(pot.tier)] : null;
    lignes.push({
      heros: p.nameFr, slug: p.slug, arme: pot.weaponType, tier: pot.tier,
      recouvrement: Math.round(j * 100),
      modelise: Boolean(e && e.classification === 'modelise' && (e.regles || []).length),
      regles: e && e.regles ? e.regles.map(r => r.type).join(', ') : '',
      site: nettoyer(pot.bonusFr), jeu: nettoyer(g.texte), cle: g.cle,
    });
  }
}
lignes.sort((x, y) => x.recouvrement - y.recouvrement || x.heros.localeCompare(y.heros));

const certains = lignes.filter(l => l.recouvrement === 0);
const aVerifier = lignes.filter(l => l.recouvrement > 0);

let md = '# Potentiels : le site et le jeu ne disent pas la meme chose\n\n';
md += 'Confrontation de `7ds-stats/personnages.json` au texte francais du client\n';
md += '(`Localization/Game/fr`, build `1.8.1.2`), sur les 341 paliers dont le jeu\n';
md += 'publie une description. **301 concordent.** Les ' + lignes.length + ' ci-dessous non.\n\n';
md += 'Le recouvrement est la part de mots communs entre les deux textes. A zero,\n';
md += 'les deux phrases ne partagent aucun mot significatif : ce ne peut pas etre\n';
md += 'une reformulation.\n\n';
md += '> Ces textes ne sont pas decoratifs : `data/effets-dps.js` en tire les regles\n';
md += "> du moteur de degats. La colonne « modelise » dit si le palier fait\n";
md += '> effectivement bouger un chiffre.\n\n';

function tableau(titre, liste) {
  if (!liste.length) return '';
  let s = '## ' + titre + ' (' + liste.length + ')\n\n';
  for (const l of liste) {
    s += '### ' + l.heros + ' / ' + l.arme + ' p' + l.tier + '\n\n';
    s += '- **site** : ' + l.site + '\n';
    s += '- **jeu** : ' + l.jeu + '\n';
    s += '- recouvrement ' + l.recouvrement + ' %' + (l.modelise ? ' — **modelise** (' + l.regles + ')' : ' — non modelise') + '\n';
    s += '- cle : `' + l.cle + '`\n\n';
  }
  return s;
}
md += tableau('Aucun mot commun — divergence de fond', certains);
md += tableau('Recouvrement partiel — a trancher a la main', aVerifier);

fs.writeFileSync('c:/Users/yanni/Desktop/Site Confrérie 7ds/docs/potentiels-divergents.md', md);
console.log('paliers divergents :', lignes.length);
console.log('  aucun mot commun :', certains.length, '| dont modelises :', certains.filter(l => l.modelise).length);
console.log('  recouvrement partiel :', aVerifier.length, '| dont modelises :', aVerifier.filter(l => l.modelise).length);
console.log('ecrit : docs/potentiels-divergents.md');
