const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const stat = JSON.parse(fs.readFileSync(T + 'Item/Option_StaticTable.json', 'utf8'))[0].Rows;
const armures = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/armures.json');

const norm = (s) => String(s || '').toLowerCase();
const paliers = (r) => {
  const p = [];
  for (let i = 1; i <= 10; i++) { const v = r['Value_Add_' + i]; if (!v) break; p.push(v); }
  return p;
};

let appariees = 0, statOk = 0, statKo = [], renfOk = 0, renfKo = [];
for (const a of armures) {
  const prefixe = stat['armor_main1_' + a.gameId] ? 'armor' : 'accessory';
  const principal = stat[prefixe + '_main1_' + a.gameId];
  if (!principal) continue;
  appariees++;

  const codeJeu = norm(String(principal.AbilityType).replace('EAbilityType::', ''));
  if (codeJeu === norm(a.mainStat)) statOk++;
  else if (statKo.length < 6) statKo.push(a.nameFr + ' : site ' + a.mainStat + '  jeu ' + principal.AbilityType);

  const renf = stat[prefixe + '_main1_reinforce_' + a.gameId];
  if (renf) {
    const n = paliers(renf).length;
    if (n === a.reinforceMax) renfOk++;
    else if (renfKo.length < 6) renfKo.push(a.nameFr + ' : site reinforceMax=' + a.reinforceMax + '  jeu ' + n + ' paliers');
  }
}

console.log('armures appariees par gameId :', appariees, 'sur', armures.length);
console.log('  code de statistique principale identique :', statOk, '| ecarts :', statKo.length);
statKo.forEach(x => console.log('     ' + x));
console.log('  reinforceMax egal au nombre de paliers   :', renfOk, '| ecarts :', renfKo.length);
renfKo.forEach(x => console.log('     ' + x));

// les armures que le jeu ne connait pas sous ce prefixe
const sansEntree = armures.filter(a => !stat['armor_main1_' + a.gameId] && !stat['accessory_main1_' + a.gameId]);
const parSlot = {};
sansEntree.forEach(a => { parSlot[a.slot] = (parSlot[a.slot] || 0) + 1; });
console.log('\nsans entree armor_main1 :', sansEntree.length, '|', Object.entries(parSlot).map(([k, v]) => k + ':' + v).join('  '));
