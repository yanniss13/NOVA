// Liste les chemins internes des archives .pak du jeu installe par l utilisateur.
// Ne lit que l index (la table des matieres) : aucun asset n est extrait.
// Cle fournie par l utilisateur, jeu possede et installe localement.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CLE = Buffer.from(process.env.CLE_PAK, 'hex');
const MAGIC = 0x5A6F12E1;

const RACINES = [
  'C:/Program Files (x86)/Steam/steamapps/common/The Seven Deadly Sins Origin/SevenDeadlySins/Content/Paks',
  'C:/Program Files (x86)/Steam/steamapps/common/The Seven Deadly Sins Origin/SevenDeadlySins/Saved/PersistentDownloadDir/PakCache',
];

function dechiffre(fd, offset, taille) {
  const aligne = Math.ceil(taille / 16) * 16;
  const buf = Buffer.alloc(aligne);
  fs.readSync(fd, buf, 0, aligne, offset);
  const d = crypto.createDecipheriv('aes-256-ecb', CLE, null);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(buf), d.final()]).slice(0, taille);
}

class Lecteur {
  constructor(b) { this.b = b; this.p = 0; }
  i32() { const v = this.b.readInt32LE(this.p); this.p += 4; return v; }
  i64() { const v = Number(this.b.readBigInt64LE(this.p)); this.p += 8; return v; }
  saute(n) { this.p += n; }
  chaine() {
    const n = this.i32();
    if (n === 0) return '';
    if (n > 0) { const s = this.b.slice(this.p, this.p + n - 1).toString('latin1'); this.p += n; return s; }
    const s = this.b.slice(this.p, this.p + (-n) * 2 - 2).toString('utf16le'); this.p += (-n) * 2; return s;
  }
}

function cheminsDuPak(chemin) {
  const st = fs.statSync(chemin);
  const fd = fs.openSync(chemin, 'r');
  try {
    const len = Math.min(1024, st.size);
    const pied = Buffer.alloc(len);
    fs.readSync(fd, pied, 0, len, st.size - len);
    let idx = -1;
    for (let i = len - 4; i >= 0; i--) if (pied.readUInt32LE(i) === MAGIC) { idx = i; break; }
    if (idx < 0) return { erreur: 'pied introuvable', fichiers: [] };
    const indexOffset = Number(pied.readBigUInt64LE(idx + 8));
    const indexSize = Number(pied.readBigUInt64LE(idx + 16));
    const r = new Lecteur(dechiffre(fd, indexOffset, indexSize));
    const mount = r.chaine();
    r.i32();      // nombre d entrees
    r.saute(8);   // graine de hachage
    if (r.i32()) { r.i64(); r.i64(); r.saute(20); }        // index par hachage de chemin
    let dirOffset = null, dirSize = null;
    if (r.i32()) { dirOffset = r.i64(); dirSize = r.i64(); r.saute(20); }
    const fichiers = [];
    if (dirOffset !== null) {
      const dr = new Lecteur(dechiffre(fd, dirOffset, dirSize));
      const nbDossiers = dr.i32();
      for (let i = 0; i < nbDossiers; i++) {
        const dossier = dr.chaine();
        const nb = dr.i32();
        for (let j = 0; j < nb; j++) { const f = dr.chaine(); dr.i32(); fichiers.push(mount + dossier + f); }
      }
    }
    return { mount, fichiers };
  } finally { fs.closeSync(fd); }
}

const sortie = fs.createWriteStream(path.join(__dirname, 'tous-les-chemins.txt'));
let total = 0, paksLus = 0, echecs = [];
for (const racine of RACINES) {
  if (!fs.existsSync(racine)) continue;
  for (const nom of fs.readdirSync(racine).filter(f => f.endsWith('.pak')).sort()) {
    try {
      const { fichiers, erreur } = cheminsDuPak(path.join(racine, nom));
      if (erreur) { echecs.push(nom + ': ' + erreur); continue; }
      paksLus++; total += fichiers.length;
      for (const f of fichiers) sortie.write(nom + '\t' + f + '\n');
    } catch (e) { echecs.push(nom + ': ' + e.message); }
  }
}
sortie.end(() => {
  console.log('paks lus :', paksLus, '| chemins :', total);
  if (echecs.length) console.log('echecs :', echecs.slice(0, 10).join(' ; '), echecs.length > 10 ? '(+' + (echecs.length - 10) + ')' : '');
});
