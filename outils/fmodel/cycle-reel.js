const fs = require('fs');
const path = require('path');
const R = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Cha/PC';

const arrondi = (n) => Math.round(Number(n) * 1000) / 1000;

function lire(fichier) {
  const j = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const o = j.find(x => x.Type === 'AnimMontage') || j.find(x => x.Type === 'AnimSequence');
  if (!o) return null;
  const p = o.Properties || {};
  const res = { duree: arrondi(p.SequenceLength), impacts: [], enchainement: null };
  for (const n of p.Notifies || []) {
    const nom = String(n.NotifyName || '');
    if (n.LinkValue === undefined || n.LinkValue === null) continue;
    if (nom === 'EHit') res.impacts.push(arrondi(n.LinkValue));
    if (nom === 'EEnableSkipByNormalAttack') {
      const d = arrondi(n.LinkValue);
      if (res.enchainement === null || d < res.enchainement) res.enchainement = d;
    }
  }
  res.impacts.sort((a, b) => a - b);
  return res;
}

const heros = process.argv[2] || 'PC_Tristan';
const arme = process.argv[3] || 'SwordDual';
const dossier = path.join(R, heros, 'Ani', arme);

console.log(heros + ' / ' + arme);
console.log('\nanimation          duree   1er impact   enchainable a   gain');
let sommeDuree = 0, sommeEnchainement = 0, n = 0;
for (let i = 1; i <= 6; i++) {
  const candidats = [
    `${heros.replace('PC_', '')}_${arme}_NormalAtk_${i}_MTG.json`,
    `${heros.replace('PC_', '')}_${arme}_NormalAtk_${i}_MTG.json`.toLowerCase(),
  ];
  const f = candidats.map(c => path.join(dossier, c)).find(c => fs.existsSync(c));
  if (!f) continue;
  const d = lire(f);
  if (!d) continue;
  n++;
  sommeDuree += d.duree;
  const ench = d.enchainement === null ? d.duree : d.enchainement;
  sommeEnchainement += ench;
  console.log(
    ('NormalAtk_' + i).padEnd(18),
    String(d.duree).padStart(6),
    String(d.impacts[0] === undefined ? '—' : d.impacts[0]).padStart(11),
    String(d.enchainement === null ? '—' : d.enchainement).padStart(15),
    String(arrondi(d.duree - ench)).padStart(7)
  );
}
console.log('\ncycle de ' + n + ' coups');
console.log('  somme des durees brutes      :', arrondi(sommeDuree), 's');
console.log('  somme des temps enchainables :', arrondi(sommeEnchainement), 's');
console.log('  ecart                        :', arrondi(sommeDuree - sommeEnchainement), 's  (' +
  (sommeDuree ? Math.round((1 - sommeEnchainement / sommeDuree) * 100) : 0) + ' % de gain)');
