const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const table = (r) => JSON.parse(fs.readFileSync(T + r, 'utf8'))[0].Rows;

const heroMastery = table('HeroMastery/HeroMastery.json');
const statGroup = table('Actor/HeroStatGroupTable.json');
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

const ALIAS = { Dreydrin: 'Dredrin', Klotho: 'Clotho', Manny: 'Mannie', Slader: 'Slater' };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const parNom = new Map(site.map(p => [norm(p.nameEn), p]));

console.log('groupes de stats :', Object.keys(statGroup).length);
console.log('exemples de cles :', Object.keys(statGroup).slice(0, 6).join(', '), '…');

// Correspondance supposee entre les champs du site et les colonnes du jeu.
const CHAMPS = [
  ['baseHp', 'B_MaxHp'],
  ['baseAtk', 'B_Atk'],
  ['baseDef', 'B_Def'],
  ['baseSpd', 'Move_Spd'],
  ['accuracy', 'A_Accuracy'],
  ['block', 'A_Block'],
  ['critRate', 'C_Critical_Rate'],
  ['critDamage', 'C_Critical_Dam_Rate'],
  ['critResist', 'C_Critical_ResRate'],
  ['critDmgResist', 'C_Critical_DamRes_Rate'],
  ['blockDmgResist', 'D_Block_DamRes_Rate'],
];

console.log('\nheros              groupe      ' + CHAMPS.map(c => c[0]).join(' '));
let apparies = 0, sansGroupe = [], ecartsTotaux = 0, herosAvecEcart = 0;
const detail = [];

for (const [id, r] of Object.entries(heroMastery)) {
  const nomJeu = String(r.String_Tid || '').replace(/_SpecialMastery_Reward$/, '');
  const p = parNom.get(norm(ALIAS[nomJeu] || nomJeu));
  if (!p) continue;
  const cle = 'stat_' + id;
  const g = statGroup[cle];
  if (!g) { sansGroupe.push(p.nameFr + ' (' + cle + ')'); continue; }
  apparies++;
  const lignes = [];
  for (const [champSite, colJeu] of CHAMPS) {
    const vSite = p[champSite], vJeu = g[colJeu];
    if (vJeu === undefined) { lignes.push(champSite + ' : colonne ' + colJeu + ' absente du jeu'); continue; }
    if (vSite !== vJeu) lignes.push(champSite + ' : site=' + vSite + '  jeu=' + colJeu + '=' + vJeu);
  }
  if (lignes.length) { herosAvecEcart++; ecartsTotaux += lignes.length; detail.push([p.nameFr + ' (' + p.slug + ', ' + cle + ')', lignes]); }
  else console.log(p.nameFr.padEnd(18), cle.padEnd(11), 'identique sur les ' + CHAMPS.length + ' champs');
}

for (const [nom, lignes] of detail) {
  console.log('\n' + nom);
  lignes.forEach(l => console.log('   ' + l));
}
console.log('\nheros apparies a un groupe :', apparies, '| sans groupe :', sansGroupe.length ? sansGroupe.join(', ') : 'aucun');
console.log('heros presentant un ecart :', herosAvecEcart, '| ecarts :', ecartsTotaux);
