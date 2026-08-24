const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const rnd = JSON.parse(fs.readFileSync(T + 'Item/Option_RandomTable.json', 'utf8'))[0].Rows;
const ench = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/enchantements.json');

// triplets publies par le jeu
const duJeu = new Set();
const statsJeu = new Set();
for (const r of Object.values(rnd)) {
  const stat = String(r.AbilityType).replace('EAbilityType::', '');
  statsJeu.add(stat);
  duJeu.add(stat + '|' + r.Value_Min + '|' + r.Value_Max);
}
console.log('lignes du jeu :', Object.keys(rnd).length, '| triplets distincts :', duJeu.size, '| statistiques :', statsJeu.size);

// triplets publies par le site
const familles = Object.keys(ench);
console.log('familles dans enchantements.json :', familles.join(', '));
let total = 0, trouves = 0;
const absents = new Map();
const statsSite = new Set();
for (const famille of familles) {
  for (const item of ench[famille]) {
    for (const o of item.options || []) {
      total++;
      statsSite.add(o.stat);
      const cle = o.stat + '|' + o.min + '|' + o.max;
      if (duJeu.has(cle)) trouves++;
      else {
        const e = absents.get(cle) || { n: 0, exemple: item.nomFr || item.nom, famille };
        e.n++; absents.set(cle, e);
      }
    }
  }
}
console.log('\noptions citees par le site :', total);
console.log('  retrouvees a l identique dans le jeu :', trouves);
console.log('  introuvables :', total - trouves, '(' + absents.size + ' triplets distincts)');

const statsInconnues = [...statsSite].filter(s => !statsJeu.has(s));
console.log('\nstatistiques du site absentes de la table du jeu :', statsInconnues.length ? statsInconnues.join(', ') : 'aucune');

if (absents.size) {
  console.log('\n=== triplets introuvables les plus frequents ===');
  [...absents.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12)
    .forEach(([k, v]) => console.log('  ' + String(v.n).padStart(5) + '  ' + k.padEnd(34) + v.famille + ' / ' + v.exemple));
}
