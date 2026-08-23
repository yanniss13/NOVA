const actions = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/data/temps-action.json').actions;
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

// texte du potentiel par heros, arme et palier
const MOTIF_TRIPLET = /Increases Attack by .*Defense by .*Max HP by/i;
const potentiel = new Map();
for (const p of site) {
  for (const pot of p.potentials || []) {
    potentiel.set((p.slug + '|' + pot.weaponType + '|' + pot.tier).toLowerCase(), {
      texte: pot.bonusEn,
      triplet: MOTIF_TRIPLET.test(String(pot.bonusEn)),
    });
  }
}

// pour chaque variante de grade, la duree change-t-elle, et que dit le palier ?
let surTriplet = { change: 0, identique: 0 };
let surModification = { change: 0, identique: 0 };
let sansPotentiel = 0;
const exemples = [];

for (const [id, v] of Object.entries(actions)) {
  const m = /^grade_(\d+)_(.+)$/.exec(id);
  if (!m) continue;
  const base = actions[m[2]];
  if (!base || !v.heros || !v.arme) continue;
  const p = potentiel.get((v.heros + '|' + v.arme + '|' + m[1]).toLowerCase());
  if (!p) { sansPotentiel++; continue; }
  const change = Math.abs(base.duree - v.duree) > 0.002;
  const seau = p.triplet ? surTriplet : surModification;
  seau[change ? 'change' : 'identique']++;
  if (change && exemples.length < 8) {
    exemples.push((p.triplet ? '[TRIPLET] ' : '[MODIF]   ') + id + ' : ' + base.duree + ' -> ' + v.duree + ' s | ' + String(p.texte).slice(0, 70));
  }
}

console.log('=== la variante de grade change-t-elle la duree ? ===');
console.log('palier au texte "attaque/defense/PV" (aucune modification de competence attendue) :');
console.log('   duree changee :', surTriplet.change, '| duree identique :', surTriplet.identique);
console.log('palier decrivant une modification de competence :');
console.log('   duree changee :', surModification.change, '| duree identique :', surModification.identique);
console.log('variantes sans palier correspondant :', sansPotentiel);
console.log('\nexemples de changements :');
exemples.forEach(e => console.log('   ', e));
