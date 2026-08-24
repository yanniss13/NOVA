/* Confronte data/buffs-supports.js aux tables de buffs du client.

   Ce que les tests du depot verifiaient deja : que chaque valeur cite une
   phrase litterale du jeu. Ce qu'ils ne pouvaient pas verifier, faute de table
   lisible : le TRAJET du chiffre — qui recoit le buff, dans quelle
   statistique il tombe, et s'il s'ajoute a plat ou en pourcentage.

   Le chemin dans les donnees du jeu :

     data/buffs-supports.js  provenance.gameId
       -> Table/Skill/PC_SkillBehaviorTable   ligne(s) du meme prefixe
          -> BehaviorDetail_SetBuffTid[].BuffTid
             -> Table/Buff/BuffTable
                ApplyType       Team = toute l'equipe, Self = le porteur seul
                AddAbil_List[]  TargetAbil (code de stat), Type, Value
                StackType       MaxStack

   `Type` distingue deux mecaniques que le calculateur traite pareil :
     None  la valeur s'ajoute a plat
     Per   la valeur est un pourcentage de la stat du receveur

   Lancer : node outils/fmodel/verifier-buffs-officiels.js [--detail]
*/
const fs = require('fs');
const vm = require('vm');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';
const RACINE = 'c:/Users/yanni/Desktop/Site Confrérie 7ds';

const comportements = JSON.parse(fs.readFileSync(EXPORTS + '/Table/Skill/PC_SkillBehaviorTable.json', 'utf8'))[0].Rows;
const buffs = JSON.parse(fs.readFileSync(EXPORTS + '/Table/Buff/BuffTable.json', 'utf8'))[0].Rows;

const bac = { window: {} };
vm.runInNewContext(fs.readFileSync(RACINE + '/data/buffs-supports.js', 'utf8'), bac);
const table = bac.window.SEVEN_DS_BUFFS_SUPPORTS;

/* Un gameId peut se decliner en plusieurs comportements : `_buff`, `_a`, `_b`,
   et une variante par palier de potentiel (`grade_7_<id>`). On les ramasse
   tous : le buff cherche peut n'exister que dans la variante amelioree. */
const parPrefixe = new Map();
for (const nom of Object.keys(comportements)) {
  const nu = nom.replace(/^grade_\d+_/, '');
  for (const cle of new Set([nom, nu])) {
    let base = cle;
    while (base) {
      if (!parPrefixe.has(base)) parPrefixe.set(base, []);
      parPrefixe.get(base).push(nom);
      const coupe = base.lastIndexOf('_');
      if (coupe < 0) break;
      base = base.slice(0, coupe);
    }
  }
}

/* Les deux catalogues ne nomment pas les competences pareil : le site ecrit
   `gilthunder_..._passive`, le jeu `gil_thunder_..._skillpassive`. */
function variantes(gameId) {
  const base = String(gameId).replace(/^gilthunder_/, 'gil_thunder_');
  const v = new Set([base]);
  v.add(base.replace(/_passive$/, '_skillpassive'));
  v.add(base.replace(/_skillpassive$/, '_passive'));
  v.add(base.replace(/_passive$/, '_skill_passive'));
  return [...v];
}

function nomsDe(gameId) {
  for (const v of variantes(gameId)) {
    const n = parPrefixe.get(v);
    if (n && n.length) return new Set(n);
  }
  /* Dernier recours : tout l'espace du couple heros/arme. Le rapprochement
     n'est alors retenu que si le code de stat ET la valeur coincident, ce qui
     rend un faux positif tres improbable. */
  const m = /^([a-z_]+?)_(sword1h|sword2h|sworddual|wand|book|staff|axe|lance|shield|gauntlets|rapier|cudgel|bow|hammer)_/.exec(variantes(gameId)[0]);
  if (m) {
    const n = parPrefixe.get(m[1] + '_' + m[2]);
    if (n && n.length) return new Set(n);
  }
  return new Set();
}

function buffsDe(gameId) {
  const vus = new Set(), sortie = [];
  for (const nom of nomsDe(gameId)) {
    for (const set of comportements[nom].BehaviorDetail_SetBuffTid || []) {
      const tid = set.BuffTid;
      if (!tid || tid === 'None' || vus.has(tid)) continue;
      vus.add(tid);
      const b = buffs[tid];
      if (b) sortie.push({ tid, comportement: nom, buff: b });
    }
  }
  return sortie;
}

const code = s => String(s).replace(/^EAbilityType::/, '');
const bilan = { total: 0, retrouves: 0, valeurExacte: 0, valeurAutre: 0, statAbsente: 0, sansBuff: 0, surEnnemi: 0 };
const equipe = [], porteur = [], pourcent = [], ecarts = [], muets = [];

for (const [support, liste] of Object.entries(table)) {
  for (const ligne of liste) {
    bilan.total++;
    const gameId = ligne.provenance && ligne.provenance.gameId;
    const trouves = gameId ? buffsDe(gameId) : [];
    if (!trouves.length) { bilan.sansBuff++; muets.push(support + ' / ' + ligne.id + '  (' + gameId + ')'); continue; }

    /* La stat visee cote site. Les lignes « cible: ennemi » portent `effet`
       et non `stat` : elles ne se rapprochent pas d'un code d'abilite. */
    /* Les lignes « cible: ennemi » portent `effet` et non `stat` : elles
       visent une statistique de la cible, dont le code n'est pas publie par le
       depot. Elles sont comptees a part, pas comme un echec. */
    const stat = ligne.stat;
    if (!stat) { bilan.surEnnemi++; continue; }

    let vu = null;
    for (const { tid, buff } of trouves) {
      for (const a of buff.AddAbil_List || []) {
        if (code(a.TargetAbil) !== stat) continue;
        vu = { tid, a, buff };
        break;
      }
      if (vu) break;
    }
    if (!vu) { bilan.statAbsente++; ecarts.push({ support, ligne, motif: 'stat ' + stat + ' absente des buffs ' + trouves.map(x => x.tid).join(',') }); continue; }

    bilan.retrouves++;
    const attendu = ligne.parCumul != null ? ligne.parCumul : ligne.valeur;
    const recu = vu.a.Value;
    if (recu === attendu) bilan.valeurExacte++;
    else { bilan.valeurAutre++; ecarts.push({ support, ligne, motif: 'valeur ' + attendu + ' attendue, ' + recu + ' dans le jeu (buff ' + vu.tid + ')' }); }

    const portee = String(vu.buff.ApplyType).replace(/^EApplyType::/, '');
    (portee === 'Team' ? equipe : porteur).push(support + ' / ' + ligne.id + '  [' + portee + ']');
    const t = String(vu.a.Type).replace(/^EAbilityStatValueType::/, '');
    if (t === 'Per') pourcent.push(support + ' / ' + ligne.id + '  ' + stat + ' +' + recu / 100 + ' % de la stat du receveur');
  }
}

console.log('lignes de data/buffs-supports.js  :', bilan.total);
console.log('  visant une stat de l ennemi    :', bilan.surEnnemi, '(hors de portee de ce controle)');
console.log('  visant une stat alliee          :', bilan.total - bilan.surEnnemi);
console.log('  rapprochees d\'un buff du jeu   :', bilan.retrouves);
console.log('     valeur identique             :', bilan.valeurExacte);
console.log('     valeur differente            :', bilan.valeurAutre);
console.log('  stat introuvable dans le buff   :', bilan.statAbsente);
console.log('  aucun buff trouve pour le gameId:', bilan.sansBuff);
console.log('\nportee lue dans le jeu :');
console.log('  toute l\'equipe (Team) :', equipe.length);
console.log('  le porteur seul       :', porteur.length);
console.log('applique en POURCENTAGE de la stat du receveur :', pourcent.length);

if (process.argv.includes('--detail')) {
  const bloc = (t, l) => { console.log('\n===== ' + t + ' (' + l.length + ') ====='); l.forEach(x => console.log('  ' + (typeof x === 'string' ? x : x.support + ' / ' + x.ligne.id + ' — ' + x.motif))); };
  bloc('PORTEE EQUIPE', equipe);
  bloc('PORTEE PORTEUR', porteur);
  bloc('EN POURCENTAGE', pourcent);
  bloc('ECARTS', ecarts);
  bloc('SANS BUFF RETROUVE', muets);
}
