const fs = require('fs');
const path = require('path');
const R = process.argv[2] || 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Cha/PC/PC_Tristan/Ani/SwordDual';

function parcours(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) parcours(f, out); else if (f.endsWith('.json')) out.push(f);
  }
  return out;
}

const resultats = [];
for (const f of parcours(R)) {
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  for (const o of j) {
    if (o.Type !== 'AnimSequence' && o.Type !== 'AnimMontage') continue;
    const p = o.Properties || {};
    const notifies = (p.Notifies || []).map(n => ({
      t: n.LinkValue !== undefined ? n.LinkValue : n.TriggerTimeOffset,
      classe: n.Notify && n.Notify.ObjectName ? n.Notify.ObjectName : (n.NotifyName || '?'),
    })).filter(n => n.t !== undefined);
    resultats.push({
      nom: o.Name,
      type: o.Type,
      duree: p.SequenceLength,
      nbNotifies: (p.Notifies || []).length,
      coups: notifies.filter(n => /Hit/i.test(String(n.classe))).map(n => Number(n.t).toFixed(3)),
    });
  }
}

resultats.sort((a, b) => a.nom.localeCompare(b.nom));
console.log('animations lues :', resultats.length);
console.log('\nnom                                        type          duree(s)  notifies  instants de coup');
for (const r of resultats) {
  console.log(
    r.nom.padEnd(42),
    String(r.type).padEnd(13),
    (r.duree === undefined ? '—' : Number(r.duree).toFixed(3)).padStart(8),
    String(r.nbNotifies).padStart(9),
    '  ' + (r.coups.length ? r.coups.join(', ') : '')
  );
}
