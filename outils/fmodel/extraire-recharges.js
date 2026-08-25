/* Les temps de recharge lus dans `Table/Skill/PC_SkillTable`, debloquee par le
   usmap 1.8 le 25 aout 2026.

   POURQUOI CE FICHIER EXISTE

   `data/competences.js` tient ses recharges de SevenCodex, qui les tronque a la
   seconde et se trompe sur quatre d'entre elles. Le client, lui, les donne en
   millisecondes. Sur les 224 competences ou les deux parlent :

       207 concordent
        13 divergent par simple troncature de SevenCodex (16,2 s publie « 16 »)
         4 sont fausses, dont Q et R d'Elizabeth qui sont INVERSEES

   Le jeu prime. Ce fichier est la source, `generate-competences.py` le
   consomme, et il se regenere en une commande apres chaque nouvel export.

   Sortie : 7ds-stats/recharges-du-jeu.json

   Lancer : node outils/fmodel/extraire-recharges.js
*/
const fs = require('fs');
const path = require('path');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';
const DEPOT = path.resolve(__dirname, '..', '..');

const skills = JSON.parse(fs.readFileSync(
  EXPORTS + '/Table/Skill/PC_SkillTable.json', 'utf8'))[0].Rows;

// Le catalogue du site, pour ne retenir que ce qu'il publie.
global.window = {};
require(DEPOT + '/data/competences.js');
const catalogue = global.window.SEVEN_DS_COMPETENCES;

const parGameId = new Map();
for (const [cle, ligne] of Object.entries(skills)) {
  parGameId.set(cle.toLowerCase(), ligne);
}

const recharges = {};
const divergences = [];
let apparies = 0, sansRecharge = 0;

for (const [slug, liste] of Object.entries(catalogue)) {
  for (const c of liste) {
    const id = String(c.gameId || '').toLowerCase();
    const ligne = parGameId.get(id);
    if (!ligne) continue;
    apparies++;
    const brut = ligne.Cooltime || 0;
    if (!brut) { sansRecharge++; continue; }
    /* `Cooltime` est en millisecondes. On publie des secondes, en gardant la
       decimale : c'est precisement ce que SevenCodex perd. */
    const secondes = Math.round(brut / 100) / 10;
    recharges[c.gameId] = secondes;
    const depot = c.recharge;
    if (depot !== null && depot !== undefined && Math.abs(depot - secondes) > 0.051) {
      divergences.push({
        slug, gameId: c.gameId, nom: c.nom,
        depot, jeu: secondes,
        // Une troncature a la seconde n'est pas une erreur, juste une perte.
        nature: Math.trunc(secondes) === Math.trunc(depot) ? 'troncature' : 'desaccord',
      });
    }
  }
}

const sortie = {
  _provenance: {
    source: 'Table/Skill/PC_SkillTable, colonne Cooltime',
    unite: 'le jeu stocke des millisecondes ; ce fichier publie des secondes',
    build: '1.8.1.2, export du 25 aout 2026, usmap mappings-1.8',
    regenerer: 'node outils/fmodel/extraire-recharges.js',
    note: 'Prime sur SevenCodex, qui tronque a la seconde. Les competences absentes de ce fichier n\'ont pas de recharge dans le jeu (valeur 0).',
  },
  recharges,
};
fs.writeFileSync(DEPOT + '/7ds-stats/recharges-du-jeu.json',
  JSON.stringify(sortie, null, 1) + '\n', 'utf8');

console.log('competences du catalogue appariees : ' + apparies);
console.log('  avec une recharge dans le jeu     : ' + Object.keys(recharges).length);
console.log('  sans recharge (Cooltime = 0)      : ' + sansRecharge);
console.log('');
const troncatures = divergences.filter(d => d.nature === 'troncature');
const desaccords = divergences.filter(d => d.nature === 'desaccord');
console.log('divergences avec le depot : ' + divergences.length
  + '  (' + troncatures.length + ' troncatures, ' + desaccords.length + ' desaccords)');
console.log('');
console.log('--- les desaccords, a corriger ---');
for (const d of desaccords) {
  console.log('   ' + d.gameId.padEnd(34) + ' depot ' + String(d.depot).padStart(6)
    + ' s   jeu ' + String(d.jeu).padStart(6) + ' s   ' + (d.nom || ''));
}
console.log('');
console.log('--- les troncatures, decimale perdue ---');
for (const d of troncatures) {
  console.log('   ' + d.gameId.padEnd(34) + ' depot ' + String(d.depot).padStart(6)
    + ' s   jeu ' + String(d.jeu).padStart(6) + ' s');
}
console.log('');
console.log('ecrit dans 7ds-stats/recharges-du-jeu.json');
