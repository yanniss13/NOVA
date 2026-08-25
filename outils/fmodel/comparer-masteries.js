const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const table = (r) => JSON.parse(fs.readFileSync(T + r, 'utf8'))[0].Rows;

const heroMastery = table('HeroMastery/HeroMastery.json');
const commonMastery = table('HeroMastery/HeroCommonMastery.json');
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

// Le nom interne du jeu differe parfois de la translitteration du site.
const ALIAS = { Dreydrin: 'Dredrin', Klotho: 'Clotho', Manny: 'Mannie', Slader: 'Slater' };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const parNom = new Map(site.map(p => [norm(p.nameEn), p]));

// Somme des gains de maitrise commune, par identifiant de table.
const totauxParTid = {};
for (const r of Object.values(commonMastery)) {
  const tid = String(r.Common_Mastery_Tid);
  const acc = totauxParTid[tid] || (totauxParTid[tid] = { nbPaliers: 0, stats: {} });
  acc.nbPaliers++;
  const types = r.Mastery_AbilityType || [];
  const vals = r.Mastery_AbilityValue || [];
  types.forEach((t, i) => {
    const code = String(t).replace('EAbilityType::', '');
    acc.stats[code] = (acc.stats[code] || 0) + (vals[i] || 0);
  });
}
console.log('=== maitrise commune : totaux calcules depuis le jeu ===');
for (const [tid, a] of Object.entries(totauxParTid)) {
  console.log(' tid', tid, '|', a.nbPaliers, 'paliers |', Object.entries(a.stats).map(([k, v]) => k + '=' + v).join('  '));
}

console.log();
console.log('=== comparaison par heros ===');
let ecarts = 0, verifies = 0;
for (const [id, r] of Object.entries(heroMastery)) {
  // Le nom du heros vit dans Weapon_Mastery_Reward. Sous le usmap 1.7 cette
  // colonne etait inconnue et sa valeur atterrissait dans String_Tid, decalant
  // toute la fin de la ligne ; le repli sur String_Tid garde la lecture des
  // extractions archivees. Voir docs/extraction-fichiers-du-jeu.md.
  const nomJeu = String(r.Weapon_Mastery_Reward || r.String_Tid || '').replace(/_SpecialMastery_Reward$/, '');
  const p = parNom.get(norm(ALIAS[nomJeu] || nomJeu));
  if (!p) continue;

  const lignes = [];

  // 1. identifiant de maitrise commune
  const tidJeu = String(r.Common_Mastery_Tid);
  if (String(p.commonMasteryTid) !== tidJeu) lignes.push('commonMasteryTid : site=' + p.commonMasteryTid + '  jeu=' + tidJeu);

  // 2. valeurs de maitrise commune
  const attendu = totauxParTid[tidJeu] ? totauxParTid[tidJeu].stats : {};
  const duSite = {};
  (p.commonMasteryStats || []).forEach(s => { duSite[s.stat] = s.value; });
  for (const code of new Set([...Object.keys(attendu), ...Object.keys(duSite)])) {
    if ((attendu[code] || 0) !== (duSite[code] || 0)) {
      lignes.push('commonMastery ' + code + ' : site=' + (duSite[code] === undefined ? 'absent' : duSite[code]) + '  jeu=' + (attendu[code] || 0));
    }
  }

  // 3. types d armes des trois emplacements
  const armesJeu = [r.Weapon_1_Mastery_Icon, r.Weapon_2_Mastery_Icon, r.Weapon_3_Mastery_Icon]
    .map(x => norm(String(x || '').replace('icon_mastery_', '')));
  const armesSite = (p.weaponSlots || []).map(s => norm(s.weapon));
  if (armesJeu.join('|') !== armesSite.join('|')) {
    lignes.push('armes : site=[' + armesSite.join(', ') + ']  jeu=[' + armesJeu.join(', ') + ']');
  }

  verifies++;
  if (lignes.length) { ecarts++; console.log('\n' + p.nameFr + ' (' + p.slug + ', id jeu ' + id + ')'); lignes.forEach(l => console.log('   ' + l)); }
}
console.log();
console.log('heros verifies :', verifies, '| heros presentant au moins un ecart :', ecarts);
