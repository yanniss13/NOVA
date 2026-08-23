const fs = require('fs');
const textes = JSON.parse(fs.readFileSync('C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
function squelette(s) {
  return String(s)
    .replace(BALISE, '')
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .replace(/\{\d+\}/g, ' ')
    .replace(/[\d.,]+\s*%/g, ' ')
    .replace(/[\d.,]+/g, ' ')
    .replace(/[^a-zàâçéèêëîïôûùüÿñæœ ]/g, ' ')
    .replace(/(^| )[a-z]( |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// descriptions de potentiel du jeu, indexees par heros+arme+palier
const jeu = new Map();
for (const [cle, v] of Object.entries(textes)) {
  const m = /^local_skill_(.+?)_potential_(\d+)_desc$/.exec(cle);
  if (!m) continue;
  jeu.set(m[1].toLowerCase().replace(/_/g, '') + '|' + m[2], { cle, texte: v });
}

let compares = 0, concordants = 0, divergents = 0, sansJeu = 0;
const ecarts = [];
for (const p of site) {
  for (const pot of p.potentials || []) {
    const k = (p.slug + pot.weaponType).toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + pot.tier;
    const g = jeu.get(k);
    if (!g) { sansJeu++; continue; }
    compares++;
    const a = squelette(pot.bonusFr), b = squelette(g.texte);
    if (!a || !b) { divergents++; continue; }
    // le site publie parfois la description complete, le jeu une portion, ou l inverse
    if (a === b || a.includes(b) || b.includes(a)) concordants++;
    else {
      divergents++;
      if (ecarts.length < 10) ecarts.push({ heros: p.nameFr, arme: pot.weaponType, tier: pot.tier, cle: g.cle, site: pot.bonusFr, jeu: g.texte });
    }
  }
}

console.log('paliers du site confrontes au jeu :', compares);
console.log('textes concordants  :', concordants);
console.log('textes divergents   :', divergents);
console.log('paliers sans description dans le jeu (statistiques pures) :', sansJeu);

for (const e of ecarts) {
  console.log('\n' + e.heros + ' / ' + e.arme + ' p' + e.tier + '   (' + e.cle + ')');
  console.log('  site : ' + String(e.site).replace(BALISE, '').slice(0, 150));
  console.log('  jeu  : ' + String(e.jeu).replace(BALISE, '').slice(0, 150));
}
