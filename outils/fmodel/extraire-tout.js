const fs = require('fs');
const path = require('path');
const R = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Cha/PC';
const DEPOT = 'c:/Users/yanni/Desktop/Site Confrérie 7ds';
const SORTIE = path.join(__dirname, 'animations-completes.json');

const ARMES = /^(sword1h|sword2h|sworddual|axe|book|wand|staff|lance|shield|rapier|gauntlets|cudgel3c)$/i;
const TAILLE_MAX = 3 * 1024 * 1024;      // au-dela, c est du Niagara, pas de l animation
// `WP_` : variantes d affichage, aucune ne porte de fenetre d annulation.
// `Backup_` : residus de production.
const IGNORER = /^fx_|^wp_|^backup_|_cam(_|$)|_lighting|_sub\d*$/i;

const arrondi = (n) => Math.round(Number(n) * 1000) / 1000;

// --- collecte des fichiers d animation, par heros et par arme ---
const aTraiter = [];
for (const dossierHeros of fs.readdirSync(R, { withFileTypes: true })) {
  if (!dossierHeros.isDirectory() || !/^PC_/.test(dossierHeros.name)) continue;
  const racineAni = path.join(R, dossierHeros.name, 'Ani');
  if (!fs.existsSync(racineAni)) continue;
  for (const dossierArme of fs.readdirSync(racineAni, { withFileTypes: true })) {
    if (!dossierArme.isDirectory() || !ARMES.test(dossierArme.name)) continue;
    (function parcours(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) { parcours(f); continue; }
        if (!f.endsWith('.json')) continue;
        const base = e.name.replace(/\.json$/, '');
        if (IGNORER.test(base)) continue;
        if (fs.statSync(f).size > TAILLE_MAX) continue;
        aTraiter.push({
          heros: dossierHeros.name.replace(/^PC_/, ''),
          arme: dossierArme.name,
          base,
          fichier: f,
        });
      }
    })(path.join(racineAni, dossierArme.name));
  }
}
console.log('fichiers candidats :', aTraiter.length);

function lire(fichier) {
  let j;
  try { j = JSON.parse(fs.readFileSync(fichier, 'utf8')); } catch (e) { return null; }
  const montage = j.find(o => o.Type === 'AnimMontage');
  const sequence = j.find(o => o.Type === 'AnimSequence');
  const o = montage || sequence;
  if (!o) return null;
  const p = o.Properties || {};
  if (p.SequenceLength === undefined) return null;

  const impacts = [], fenetres = {};
  for (const n of p.Notifies || []) {
    const nom = String(n.NotifyName || '');
    const debut = n.LinkValue;
    if (debut === undefined || debut === null) continue;
    if (nom === 'EHit') { impacts.push(arrondi(debut)); continue; }
    const m = /^EEnableSkipBy(.+)$/.exec(nom);
    if (!m) continue;
    const cle = m[1].charAt(0).toLowerCase() + m[1].slice(1);
    const fin = n.EndLink && n.EndLink.LinkValue !== undefined ? arrondi(n.EndLink.LinkValue) : null;
    if (!fenetres[cle] || arrondi(debut) < fenetres[cle].debut) fenetres[cle] = { debut: arrondi(debut), fin };
  }
  impacts.sort((a, b) => a - b);
  return { estMontage: Boolean(montage), duree: arrondi(p.SequenceLength), impacts, fenetres };
}

// --- une entree par animation ; le montage prime sur la sequence nue ---
const animations = {};
let lus = 0, ignores = 0;
for (const c of aTraiter) {
  const d = lire(c.fichier);
  if (!d) { ignores++; continue; }
  lus++;
  const nomAni = c.base.replace(/_mtg$/i, '');
  const cle = (c.heros + '_' + c.arme + '_' + nomAni.replace(new RegExp('^' + c.heros + '_' + c.arme + '_', 'i'), '')).toLowerCase();
  const dejaLa = animations[cle];
  if (dejaLa && dejaLa.estMontage && !d.estMontage) continue;
  animations[cle] = {
    heros: c.heros.toLowerCase(),
    arme: c.arme,
    animation: nomAni,
    duree: d.duree,
    impacts: d.impacts,
    fenetres: d.fenetres,
    estMontage: d.estMontage,
    source: path.relative(R, c.fichier).split(path.sep).join('/'),
  };
}
console.log('animations retenues :', Object.keys(animations).length, '| fichiers sans animation :', ignores);

// --- rattachement aux gameId du depot ---
const src = fs.readFileSync(DEPOT + '/data/competences.js', 'utf8');
const parSlug = JSON.parse(src.replace(/^[\s\S]*?window\.SEVEN_DS_COMPETENCES = /, '').replace(/;\s*$/, ''));
let rattaches = 0;
for (const [slug, liste] of Object.entries(parSlug)) {
  for (const c of liste) {
    const id = String(c.gameId || '').toLowerCase();
    if (animations[id]) { animations[id].gameId = c.gameId; animations[id].nom = c.nom; rattaches++; }
  }
}
console.log('rattachees a un gameId :', rattaches);

// --- repartition par famille ---
const familles = {};
for (const v of Object.values(animations)) {
  const f = /normalatk/i.test(v.animation) ? 'auto-attaque'
    : /jumpatk/i.test(v.animation) ? 'attaque sautee'
    : /skill_/i.test(v.animation) ? 'competence'
    : /idle|walk|run|changestate/i.test(v.animation) ? 'posture et deplacement'
    : 'autre';
  familles[f] = (familles[f] || 0) + 1;
}
console.log('\nrepartition :', Object.entries(familles).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' : ' + n).join(' | '));

fs.writeFileSync(SORTIE, JSON.stringify({
  _lisezmoi: [
    'Toutes les animations de combat des heros, extraites des assets du jeu',
    '(build 1.8.1.2) via FModel. Ce ne sont pas des mesures en jeu.',
    'Cle : <heros>_<arme>_<animation>, en minuscules.',
    'duree    : SequenceLength du montage, en secondes.',
    'impacts  : instants des marqueurs EHit. UN MARQUEUR N EST PAS UN COUP :',
    '           une seule marque peut declencher une attaque a 13 coups.',
    'fenetres : premier instant ou l animation devient annulable, par type.',
    '           `normalAttack` donne le temps d enchainement reel.',
    'gameId   : present quand l animation correspond a une entree de',
    '           data/competences.js.',
  ],
  _unite: 'secondes',
  _build: '1.8.1.2',
  animations,
}, null, 1));
console.log('ecrit :', SORTIE);
