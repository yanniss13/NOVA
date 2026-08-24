/* Qui recoit un buff : le porteur seul, ou toute l'equipe ?

   C'etait la premiere inconnue de docs/buffs-supports-a-mesurer.md, chiffree
   a « 30 a 60 % de degats sur chaque build de l'equipe », et elle demandait
   une mesure en jeu. La table des buffs, illisible jusqu'au usmap du 24 aout
   2026, la tranche sans mesure : chaque buff porte un `ApplyType`.

     EApplyType::Hero   le porteur seul
     EApplyType::Team   toute l'equipe

   Les buffs n'etant pas nommes d'apres leur heros, l'attribution passe par les
   BLOCS d'identifiants. Les six premiers chiffres d'un identifiant de buff
   forment un bloc, et chaque bloc s'est revele appartenir a un seul heros :
   toutes les competences qui posent un buff du bloc 302172 sont des
   competences d'Elizabeth. Le script le verifie au lieu de le supposer, et
   signale tout bloc partage.

   Lancer : node outils/fmodel/portee-des-buffs.js [--tout]
*/
const fs = require('fs');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';
const buffs = JSON.parse(fs.readFileSync(EXPORTS + '/Table/Buff/BuffTable.json', 'utf8'))[0].Rows;
const comportements = JSON.parse(fs.readFileSync(EXPORTS + '/Table/Skill/PC_SkillBehaviorTable.json', 'utf8'))[0].Rows;
const textes = JSON.parse(fs.readFileSync(EXPORTS + '/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const parCleBasse = new Map(Object.entries(textes).map(([k, v]) => [k.toLowerCase(), v]));

const BALISE = /\[#?[-0-9A-Fa-f]*\]/g;
function lire(cle, remplacements) {
  const brut = parCleBasse.get(String(cle).toLowerCase());
  if (brut === undefined) return null;
  let sortie = brut;
  for (const r of remplacements || []) {
    const m = /^\{(\d+)\}:\{(.*)\}$/.exec(String(r));
    if (m) sortie = sortie.split('{' + m[1] + '}').join(m[2]);
  }
  return sortie.replace(BALISE, '');
}

/* Qui pose quoi, et a quel bloc appartient chaque heros. */
const blocs = new Map();
for (const [nom, r] of Object.entries(comportements)) {
  const heros = nom.replace(/^grade_\d+_/, '').split('_')[0];
  for (const s of r.BehaviorDetail_SetBuffTid || []) {
    const tid = String(s.BuffTid || '');
    if (!/^\d{6,}$/.test(tid)) continue;
    const bloc = tid.slice(0, 6);
    if (!blocs.has(bloc)) blocs.set(bloc, new Map());
    const m = blocs.get(bloc);
    m.set(heros, (m.get(heros) || 0) + 1);
  }
}

const proprietaire = new Map();
const partages = [];
for (const [bloc, m] of blocs) {
  if (m.size === 1) proprietaire.set(bloc, [...m.keys()][0]);
  else partages.push(bloc + ' : ' + [...m.keys()].join(', '));
}

console.log('blocs d identifiants de buff rattaches a un heros :', proprietaire.size);
console.log('blocs partages entre plusieurs heros              :', partages.length);
if (partages.length) partages.forEach(p => console.log('   ' + p));

/* Ce qui interesse le calculateur : un bonus de degats ou une statistique
   offensive, donne a toute l'equipe, par un heros identifiable. */
const OFFENSIF = /DamAdd_Rate|Critical|_Add$|_Element_Rate|AtkAdd|B_Atk/;
const collectifs = [];
for (const [id, b] of Object.entries(buffs)) {
  if (String(b.ApplyType) !== 'EApplyType::Team') continue;
  const heros = proprietaire.get(String(id).slice(0, 6));
  if (!heros) continue;
  for (const a of b.AddAbil_List || []) {
    const stat = String(a.TargetAbil).replace('EAbilityType::', '');
    if (stat === 'None' || !a.Value) continue;
    if (!process.argv.includes('--tout') && !OFFENSIF.test(stat)) continue;
    collectifs.push({
      heros, id, stat,
      valeur: a.Value,
      mode: String(a.Type).replace('EAbilityStatValueType::', ''),
      cumuls: (b.StackType && b.StackType.MaxStack) || 1,
      nom: lire(b.Local_Key, []),
      desc: lire(b.Local_Desc, b.Local_Replace),
    });
  }
}

collectifs.sort((x, y) => x.heros.localeCompare(y.heros) || x.stat.localeCompare(y.stat));
console.log('\nbuffs OFFENSIFS de portee EQUIPE, par heros :', collectifs.length);
let courant = '';
for (const c of collectifs) {
  if (c.heros !== courant) { courant = c.heros; console.log('\n' + courant); }
  /* `None` = la valeur s'ajoute a plat. `Per` = elle vaut ce pourcentage
     d'une statistique du lanceur, calcule au moment ou le buff est pose. */
  const mode = c.mode === 'Per' ? ' d une stat du lanceur' : '';
  console.log('  ' + c.id + '  ' + c.stat.padEnd(32) + String(c.valeur / 100).padStart(7) + ' %' + mode
    + (c.cumuls > 1 ? '  x' + c.cumuls + ' cumuls' : ''));
  if (c.desc) console.log('        ' + c.desc.split('\n')[0]);
  else console.log('        (buff sans description ni icone : invisible en jeu)');
}
