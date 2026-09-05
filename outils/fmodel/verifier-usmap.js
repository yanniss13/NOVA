// Lit un .usmap et le compare a un autre, sans passer par FModel.
//
// Ecrit le 5 septembre 2026, quand le usmap a commence a se fabriquer en local
// avec Dumper-7 : il fallait pouvoir dire "ce dump est bon" avant de le charger
// et de reexporter 65 000 fichiers pour s en apercevoir.
//
//   node outils/fmodel/verifier-usmap.js <fichier.usmap>
//   node outils/fmodel/verifier-usmap.js <nouveau.usmap> <ancien.usmap>
//
// Un usmap sain se relit JUSQU AU DERNIER OCTET. S il reste des octets, le
// fichier ment quelque part et il ne faut pas le charger.
//
// Deux pieges de la version 4 du format, qui ont coute une heure :
//   - chaque entree d enumeration porte une valeur int64 AVANT son index de nom
//   - le nombre de proprietes serialisees compte des ENTREES, pas des cases de
//     tableau : une propriete ArrayDim=4 occupe 4 index de schema mais une
//     seule entree.
//
// La seule mesure qui compte dans une comparaison, ce sont les structs UE*,
// c est a dire les tables du jeu. Le nombre de noms et la taille du fichier ne
// disent rien : Dumper-7 compresse en Zstd et n ecrit pas le bloc final
// CEXT/PPTH que portent les usmap passes par FModel.

const fs = require('fs');
const zlib = require('zlib');

// EPropertyType : seuls ces types portent une charge utile apres leur octet.
const ENUM_PROP = 26, STRUCT_PROP = 9, MAP_PROP = 24;
const CONTENEURS = new Set([8 /* Array */, 25 /* Set */, 28 /* Optional */]);

function lire(chemin) {
  const d = fs.readFileSync(chemin);
  if (d.readUInt16LE(0) !== 0x30c4) throw new Error(chemin + ' : ce n est pas un usmap');
  const version = d.readUInt8(2);
  let o = 3;
  if (version >= 3) {
    const versionne = d.readInt32LE(o); o += 4;
    if (versionne) { o += 8; o += 4 + d.readInt32LE(o) * 20; o += 4; }
  }
  const compression = d.readUInt8(o); o += 1;
  const tailleCompressee = d.readUInt32LE(o); o += 4;
  const tailleBrute = d.readUInt32LE(o); o += 4;
  let corps = d.subarray(o, o + tailleCompressee);
  if (compression === 3) corps = zlib.zstdDecompressSync(corps);
  else if (compression !== 0) throw new Error('compression inconnue : ' + compression);
  if (corps.length !== tailleBrute) throw new Error('taille decompressee inattendue');
  return { version, compression, tailleBrute, corps };
}

function analyser(chemin) {
  const { version, compression, tailleBrute, corps } = lire(chemin);
  let o = 0;
  const u8 = () => corps.readUInt8(o++);
  const u16 = () => { const v = corps.readUInt16LE(o); o += 2; return v; };
  const i32 = () => { const v = corps.readInt32LE(o); o += 4; return v; };
  const u32 = () => { const v = corps.readUInt32LE(o); o += 4; return v; };

  const noms = [];
  for (let n = u32(), i = 0; i < n; i++) {
    const l = version >= 2 ? u16() : u8();
    noms.push(corps.toString('utf8', o, o + l)); o += l;
  }
  const nom = (i) => (i >= 0 && i < noms.length ? noms[i] : null);

  const enums = new Map();
  for (let n = u32(), i = 0; i < n; i++) {
    const cle = nom(i32());
    const nb = version >= 3 ? u16() : u8();
    const valeurs = [];
    for (let j = 0; j < nb; j++) { if (version >= 4) o += 8; valeurs.push(nom(i32())); }
    enums.set(cle, valeurs);
  }

  // Un type de propriete peut en contenir d autres : on descend.
  function sauterType() {
    const t = u8();
    if (t === ENUM_PROP) { sauterType(); i32(); }
    else if (t === STRUCT_PROP) i32();
    else if (CONTENEURS.has(t)) sauterType();
    else if (t === MAP_PROP) { sauterType(); sauterType(); }
  }

  const structs = new Map();
  for (let n = u32(), i = 0; i < n; i++) {
    const cle = nom(i32());
    const parent = nom(i32());
    u16();                       // nombre total de proprietes
    const serialisees = u16();   // nombre d ENTREES qui suivent
    const props = [];
    for (let j = 0; j < serialisees; j++) { u16(); u8(); props.push(nom(i32())); sauterType(); }
    structs.set(cle, { parent, props });
  }

  // Les usmap passes par FModel ajoutent un bloc CEXT/PPTH (chemins de
  // packages) apres les structs. Il est legitime : ce n est pas un reliquat.
  const extension = o < corps.length && corps.toString('ascii', o, o + 4) === 'CEXT';
  return { chemin, version, compression, tailleBrute, noms, enums, structs,
           lu: o, total: corps.length, extension };
}

function resume(u) {
  const tables = [...u.structs.keys()].filter((k) => k && k.startsWith('UE')).length;
  console.log(u.chemin.split(/[\/]/).pop());
  console.log('  version %d | %s | %d o bruts', u.version,
    u.compression === 3 ? 'Zstd' : 'non compresse', u.tailleBrute);
  console.log('  %d noms | %d enums | %d structs, dont %d tables du jeu (UE*)',
    u.noms.length, u.enums.size, u.structs.size, tables);
  if (u.lu === u.total) console.log('  relu jusqu au dernier octet : SAIN');
  else if (u.extension) console.log('  SAIN — suivi d un bloc CEXT/PPTH de %d o (chemins de packages)', u.total - u.lu);
  else console.log('  ATTENTION : %d octets non lus sur %d, et pas de bloc CEXT — NE PAS CHARGER', u.total - u.lu, u.total);
}

function comparer(a, b) {
  console.log('\n=== %s  contre  %s', a.chemin.split(/[\/]/).pop(), b.chemin.split(/[\/]/).pop());
  const ue = (u) => new Set([...u.structs.keys()].filter((k) => k && k.startsWith('UE')));
  const perdues = [...ue(b)].filter((k) => !ue(a).has(k));
  const gagnees = [...ue(a)].filter((k) => !ue(b).has(k));
  console.log('tables du jeu perdues : %d %s', perdues.length, perdues.slice(0, 10).join(', '));
  console.log('tables du jeu gagnees : %d %s', gagnees.length, gagnees.slice(0, 10).join(', '));

  const retrait = [], enrichis = [];
  for (const [k, v] of a.enums) {
    const ancien = b.enums.get(k);
    if (!ancien) continue;
    if (v.length < ancien.length) retrait.push(k + ' ' + ancien.length + ' -> ' + v.length);
    else if (v.length > ancien.length) enrichis.push(k + ' ' + ancien.length + ' -> ' + v.length);
  }
  console.log('enums enrichis : %d %s', enrichis.length, enrichis.slice(0, 8).join(' | '));
  console.log('enums EN RETRAIT : %d %s', retrait.length, retrait.join(' | '));

  const amputes = [];
  for (const [k, v] of a.structs) {
    const ancien = b.structs.get(k);
    if (ancien && v.props.length < ancien.props.length) {
      amputes.push(k + ' ' + ancien.props.length + ' -> ' + v.props.length);
    }
  }
  console.log('structs avec MOINS de proprietes : %d %s', amputes.length, amputes.slice(0, 10).join(' | '));
  console.log('\nUn enum en retrait ou un struct ampute est une regression :');
  console.log('le usmap etiquettera faux en silence, sans jamais laisser une table vide.');
}

const args = process.argv.slice(2);
if (!args.length) {
  console.log('usage : node outils/fmodel/verifier-usmap.js <fichier.usmap> [ancien.usmap]');
  process.exit(1);
}
const analyses = args.map(analyser);
analyses.forEach(resume);
if (analyses.length === 2) comparer(analyses[0], analyses[1]);
