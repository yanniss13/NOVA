const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const stat = JSON.parse(fs.readFileSync(T + 'Item/Option_StaticTable.json', 'utf8'))[0].Rows;
const over = JSON.parse(fs.readFileSync(T + 'Item/ItemTable_Growth_Overlimit.json', 'utf8'))[0].Rows;
const armes = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/armes.json');

// --- statistique principale et secondaire, arme par arme ---
function progression(r) {
  const p = [];
  for (let i = 1; i <= 7; i++) {
    const v = r['Value_Add_' + i];
    if (v === undefined || v === 0) break;
    p.push(v);
  }
  return p;
}

let comparees = 0, baseOk = 0, progOk = 0;
const ecarts = [];
for (const a of armes) {
  for (const g of a.grades || []) {
    for (const [prefixe, champ] of [['weapon_main1_', 'mainStatValues'], ['weapon_sub1_', 'subStatValues']]) {
      const r = stat[prefixe + g.gameId];
      const s = g[champ];
      if (!r || !s) continue;
      comparees++;
      const bOk = Number(r.Value_Base) === Number(s.base);
      const pJeu = progression(r).join(','), pSite = (s.progression || []).join(',');
      if (bOk) baseOk++;
      if (pJeu === pSite) progOk++;
      if ((!bOk || pJeu !== pSite) && ecarts.length < 8) {
        ecarts.push(a.nameFr + ' / ' + g.rarity + ' / ' + champ + ' : site base=' + s.base + ' prog=[' + pSite + ']  jeu base=' + r.Value_Base + ' prog=[' + pJeu + ']');
      }
    }
  }
}
console.log('=== statistiques d armes (Option_StaticTable, appariee par gameId) ===');
console.log('couples compares :', comparees);
console.log('  valeur de base identique  :', baseOk);
console.log('  progression identique     :', progOk);
ecarts.forEach(e => console.log('   ' + e));

// --- depassement de limite, sur les champs partages ---
const empJeu = new Set(Object.values(over).map(r => [r.Overlimit_Level, r.exp, r.Passive_Level, r.Overlimit_Stat_Rate].join('|')));
const coutsJeu = new Set(Object.values(over).map(r => r.Cost));
let tot = 0, ok = 0, orOk = 0;
for (const a of armes) for (const g of a.grades || []) {
  for (const n of (g.overlimit && g.overlimit.levels) || []) {
    tot++;
    if (empJeu.has([n.level, n.exp, n.passiveLevel, n.statRate].join('|'))) ok++;
    if (coutsJeu.has(n.gold)) orOk++;
  }
}
console.log('\n=== depassement de limite ===');
console.log('paliers cites par le site :', tot);
console.log('  niveau + exp + passif + taux retrouves :', ok);
console.log('  cout en or retrouve                    :', orOk);
