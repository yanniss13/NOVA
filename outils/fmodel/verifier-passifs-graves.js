/* Confronte data/passifs-graves.js aux tables du client.

   Meme intention que verifier-buffs-officiels.js, sur l'autre table ecrite a
   la main : le TRAJET du chiffre. Le site declare une stat par ligne ; le jeu
   la nomme dans BuffTable. Une transcription peut citer la bonne phrase et se
   tromper de seau — c'est arrive, et c'est muet.

   Le chemin :

     data/passifs-graves.js   cle = fichier de la tenue
       -> nom francais (le fichier porte le nom de la tenue)
          -> Item/ItemTable_Data_Equip   ligne itemdivision_bindarmor
             Equip_Passive[].EquipPassiveID   ex. EpEq_Ban_B
             -> Buff/BuffTable   lignes qui citent cet identifiant
                AddAbil_List[].TargetAbil   le code de stat

   CE QUI N'EST PAS VERIFIABLE, et il faut le dire : beaucoup de ces lignes de
   BuffTable ont un AddAbil_List VIDE et delegent a un comportement
   `EpEq_<...>_Lv<n>` qui n'existe dans AUCUNE table exportee. Leur effet est
   hors de portee ici. L'outil les compte a part plutot que de les taire : un
   rapport qui annonce « tout est bon » en ayant saute la moitie des lignes
   vaut moins que rien.

   Lancer : node outils/fmodel/verifier-passifs-graves.js [--detail]
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';
const RACINE = path.resolve(__dirname, '..', '..');
const DETAIL = process.argv.includes('--detail');

const table = f => JSON.parse(fs.readFileSync(EXPORTS + '/Table/' + f, 'utf8'))[0].Rows;
const items = table('Item/ItemTable_Data_Equip.json');
const buffs = table('Buff/BuffTable.json');
const loc = JSON.parse(
  fs.readFileSync(EXPORTS + '/Localization/Game/fr/Game.json', 'utf8')
).client_language_table;

const bac = { window: {} };
vm.runInNewContext(fs.readFileSync(RACINE + '/data/passifs-graves.js', 'utf8'), bac);
const graves = bac.window.SEVEN_DS_PASSIFS_GRAVES;

/* Le nom francais de la tenue est la seule cle commune aux deux mondes : le
   depot nomme ses fichiers d'apres lui, le jeu le publie sous Local_Key. */
const parNom = new Map();
for (const [id, v] of Object.entries(items)) {
  if (v.Local_ItemDivisionTag !== 'itemdivision_bindarmor') continue;
  const nom = loc[String(v.Local_Key || '').toLowerCase()];
  const passifs = [...new Set((v.Equip_Passive || [])
    .map(p => p.EquipPassiveID).filter(x => x && x !== 'None'))];
  if (nom && passifs.length) parNom.set(nom.trim(), { id, passifs });
}

/* Les stats qu'un EpEq pose vraiment, quand la ligne les porte en ligne. */
const statsParPassif = new Map();
const delegue = new Map();
for (const v of Object.values(buffs)) {
  const cites = JSON.stringify(v).match(/EpEq_[A-Za-z0-9_]+/g);
  if (!cites) continue;
  for (const brut of new Set(cites)) {
    const racine = brut.replace(/_(Buff|Stack|BuffTime).*$/, '').replace(/_Lv\d+$/, '');
    if (!statsParPassif.has(racine)) statsParPassif.set(racine, new Set());
    const posees = (v.AddAbil_List || [])
      .map(a => String(a.TargetAbil || '').split('::')[1])
      .filter(s => s && s !== 'None');
    posees.forEach(s => statsParPassif.get(racine).add(s));
    if (!posees.length) delegue.set(racine, (delegue.get(racine) || 0) + 1);
  }
}

/* DEUXIEME ROUTE, et elle double la couverture. Toutes les lignes de buff ne
   citent pas leur `EpEq_` : beaucoup ne se rattachent au passif que par leur
   `Local_Desc`, qui suit la convention
   `local_equippassive_bindarmor_<heros>_<lettre>_lv<n>...`. Sans cette route,
   les deux effets du « Cuisinier remplacant » de Ban restaient invisibles
   alors que la table les porte noir sur blanc. */
for (const v of Object.values(buffs)) {
  const desc = String(v.Local_Desc || '').toLowerCase();
  const m = /^local_equippassive_(?:bindarmor|weapon)_([a-z0-9]+)_([a-z])_lv/.exec(desc);
  if (!m) continue;
  const racine = 'EpEq_' + m[1].charAt(0).toUpperCase() + m[1].slice(1)
    + '_' + m[2].toUpperCase();
  if (!statsParPassif.has(racine)) statsParPassif.set(racine, new Set());
  (v.AddAbil_List || [])
    .map(a => String(a.TargetAbil || '').split('::')[1])
    .filter(x => x && x !== 'None')
    .forEach(x => statsParPassif.get(racine).add(x));
}

const nomDeFichier = cle => path.basename(cle).replace(/\.webp$/i, '');
const meme = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

let confirmes = 0;
const ecarts = [], aConfirmer = [], horsPortee = [], sansTenue = [], parEffet = [];

for (const [cle, lignes] of Object.entries(graves)) {
  const nom = nomDeFichier(cle);
  const info = parNom.get(nom);
  if (!info) { sansTenue.push(nom); continue; }
  const attendues = new Set();
  info.passifs.forEach(p => (statsParPassif.get(p) || []).forEach(s => attendues.add(s)));
  /* Les lignes qui portent un `effet` et non un `stat` decrivent un debuff sur
     l'ennemi, modelise par sa mecanique et non par un code du jeu. Rien a
     confronter ici : les compter en echec serait un faux proces. */
  const avecStat = lignes.filter(l => l.stat);
  parEffet.push(...lignes.filter(l => !l.stat).map(l => l.id));
  for (const ligne of avecStat) {
    const vue = { tenue:nom, id:ligne.id, stat:ligne.stat,
      passifs:info.passifs, vues:[...attendues] };
    if (!attendues.size) { horsPortee.push(vue); continue; }
    if ([...attendues].some(s => meme(s, ligne.stat))) { confirmes++; continue; }
    /* La table ne montre pas tout : une tenue porte deux ou trois effets et
       une seule de ses lignes de buff expose ses stats. Tant qu'on en voit
       MOINS que le site n'en declare, l'absence ne prouve rien — on ne peut
       pas distinguer une erreur d'une vue partielle. */
    if (attendues.size < avecStat.length) aConfirmer.push(vue);
    else ecarts.push(vue);
  }
}

console.log('tenues gravees dans le jeu    : ' + parNom.size);
console.log('tenues modelisees par le site : ' + Object.keys(graves).length);
console.log('');
console.log('  lignes CONFIRMEES par la table : ' + confirmes);
console.log('  lignes EN ECART                : ' + ecarts.length);
console.log('  lignes a confirmer             : ' + aConfirmer.length
  + '   (vue partielle : le jeu expose moins de stats que le site n en declare)');
console.log('  lignes hors de portee          : ' + horsPortee.length
  + '   (AddAbil_List vide, effet delegue a un comportement non exporte)');
console.log('  lignes decrites par un effet   : ' + parEffet.length
  + '   (debuff sur l ennemi, sans code de stat a confronter)');
if (sansTenue.length) console.log('  tenues introuvables au catalogue : ' + sansTenue.length
  + (DETAIL ? ' -> ' + sansTenue.join(', ') : ''));

function afficher(titre, liste) {
  if (!liste.length) return;
  console.log(chr10 + '  ' + titre);
  for (const e of liste) {
    console.log('    ' + e.tenue + ' / ' + e.id);
    console.log('       site : ' + e.stat);
    console.log('       jeu  : ' + e.vues.join(', ') + '   (' + e.passifs.join(', ') + ')');
  }
}
const chr10 = String.fromCharCode(10);
afficher('EN ECART', ecarts);
if (DETAIL) afficher('A CONFIRMER', aConfirmer);

process.exit(ecarts.length ? 1 : 0);
