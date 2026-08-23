const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const table = (r) => JSON.parse(fs.readFileSync(T + r, 'utf8'))[0].Rows;

const heroMastery = table('HeroMastery/HeroMastery.json');
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

console.log('heros dans le jeu :', Object.keys(heroMastery).length, '| heros sur le site :', site.length);
console.log();
console.log('id    nom (jeu)          masterie commune  armes (icones du jeu)');
const nomsJeu = {};
for (const [id, r] of Object.entries(heroMastery)) {
  const nom = String(r.String_Tid || '').replace(/_SpecialMastery_Reward$/, '');
  nomsJeu[id] = nom;
  const armes = [r.Weapon_1_Mastery_Icon, r.Weapon_2_Mastery_Icon, r.Weapon_3_Mastery_Icon]
    .map(x => String(x || '').replace('icon_mastery_', ''));
  console.log(id.padEnd(6), nom.padEnd(18), String(r.Common_Mastery_Tid).padEnd(17), armes.join(', '));
}

console.log();
console.log('=== correspondance avec le site (par nom anglais) ===');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const parNom = new Map(site.map(p => [norm(p.nameEn), p]));
const apparies = [], orphelinsJeu = [];
for (const [id, nom] of Object.entries(nomsJeu)) {
  const p = parNom.get(norm(nom));
  if (p) { apparies.push([id, nom, p]); parNom.delete(norm(nom)); }
  else orphelinsJeu.push([id, nom]);
}
console.log('apparies :', apparies.length);
console.log('dans le jeu mais absents du site :', orphelinsJeu.map(([i, n]) => n + '(' + i + ')').join(', ') || 'aucun');
console.log('sur le site mais introuvables dans le jeu :', [...parNom.values()].map(p => p.nameEn).join(', ') || 'aucun');
