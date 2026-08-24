const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

// Certains paliers annoncent un gain ternaire attaque / defense / PV max.
// On les repere sur le texte anglais, plus stable que le francais.
const MOTIF = /Increases Attack by \[#1A7331\]([\d.]+)%\[-\], Defense by \[#1A7331\]([\d.]+)%\[-\], and Max HP by \[#1A7331\]([\d.]+)%\[-\]/;

function reconstruire(potentiels) {
  // cumul par type d arme, palier par palier
  const parArme = {};
  for (const pot of potentiels) (parArme[pot.weaponType] || (parArme[pot.weaponType] = [])).push(pot);
  const resultat = new Map();
  for (const [arme, liste] of Object.entries(parArme)) {
    liste.sort((a, b) => a.tier - b.tier);
    let atk = 0, def = 0, hp = 0;
    for (const pot of liste) {
      const m = MOTIF.exec(String(pot.bonusEn));
      if (m) { atk += Math.round(Number(m[1]) * 100); def += Math.round(Number(m[2]) * 100); hp += Math.round(Number(m[3]) * 100); }
      resultat.set(arme + '|' + pot.tier, [
        { stat: 'I_AtkAdd_Rate', value: atk },
        { stat: 'I_DefAdd_Rate', value: def },
        { stat: 'I_MaxHpAdd_Rate', value: hp },
      ]);
    }
  }
  return resultat;
}

console.log('=== validation de la methode sur les heros deja renseignes ===');
let okHeros = 0, koHeros = 0, okEntrees = 0, koEntrees = 0;
const echecs = [];
for (const p of site) {
  const pleins = (p.potentials || []).filter(x => x.stats && x.stats.length);
  if (!pleins.length) continue;
  const recons = reconstruire(p.potentials);
  let bon = true;
  for (const pot of pleins) {
    const attendu = JSON.stringify(recons.get(pot.weaponType + '|' + pot.tier));
    const reel = JSON.stringify(pot.stats);
    if (attendu === reel) okEntrees++;
    else { koEntrees++; bon = false; if (echecs.length < 5) echecs.push(p.nameFr + ' ' + pot.weaponType + ' p' + pot.tier + ' : reel=' + reel + ' reconstruit=' + attendu); }
  }
  bon ? okHeros++ : koHeros++;
}
console.log('heros reproduits a l identique :', okHeros, '| heros en echec :', koHeros);
console.log('entrees exactes :', okEntrees, '| entrees fausses :', koEntrees);
echecs.forEach(e => console.log('  ', e));

console.log('\n=== reconstruction pour les deux heros incomplets ===');
for (const p of site) {
  const vides = (p.potentials || []).filter(x => !x.stats || !x.stats.length);
  if (!vides.length) continue;
  const recons = reconstruire(p.potentials);
  console.log('\n' + p.nameFr + ' (' + p.slug + ', ' + p.rarity + ') — ' + vides.length + ' entrees a remplir');
  const arme = vides[0].weaponType;
  for (const pot of p.potentials.filter(x => x.weaponType === arme)) {
    const v = recons.get(arme + '|' + pot.tier);
    console.log('   ', arme, 'p' + String(pot.tier).padStart(2), ':', v.map(s => s.stat + '=' + s.value).join(' '));
  }
}
