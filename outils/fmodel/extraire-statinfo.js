/* `Actor/StatInfoTable` : le catalogue officiel des 223 statistiques du jeu.
   Table debloquee par le usmap 1.8 ; illisible jusqu'au 25 aout 2026.

   Elle produit deux choses :

   1. LES STATS QUE LE DEPOT NE CONNAIT PAS
      `libelles-stats.json` et `stat-metadata.json` couvrent 101 codes ; le jeu
      en declare 223. Les manquantes qui ne sont pas marquees `Hide` sont
      affichees au joueur et ont deja un libelle francais officiel.
      -> 7ds-stats/libelles-stats-nouvelles.json
      -> 7ds-stats/stat-metadata-nouvelles.json

   2. LES BORNES DE CHAQUE STAT
      Min et Max, tels que le moteur les applique. Utile au calcul de degats :
      `final_all_dam_rate` descend jusqu'a -10000, soit -100 %.
      -> 7ds-stats/bornes-stats.json

   TROIS DERIVATIONS, TOUTES VERIFIEES CONTRE LE DEPOT AVANT USAGE

     casse   `Local_Key` moins son prefixe `UI_` donne la cle du depot.
             75 correspondances, 0 divergence.
     unite   un code finissant par `rate` est en dix-milliemes, sinon il est
             brut. 75 justes, 0 faux.
     famille NON derivable. `elemental` s'etale sur group_5, 6, 8 et 9 ;
             `additional` sur group_1, 2 et 9. C'est une taxonomie du depot,
             pas du jeu : elle sort a null, a completer a la main.

   Lancer : node outils/fmodel/extraire-statinfo.js
*/
const fs = require('fs');
const path = require('path');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';
const DEPOT = path.resolve(__dirname, '..', '..');

const statInfo = JSON.parse(
  fs.readFileSync(EXPORTS + '/Table/Actor/StatInfoTable.json', 'utf8'))[0].Rows;
const groupes = JSON.parse(
  fs.readFileSync(EXPORTS + '/Table/Actor/StatInfoGroupTable.json', 'utf8'))[0].Rows;

function langue(code) {
  const p = EXPORTS + '/Localization/Game/' + code + '/Game.json';
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8')).client_language_table || {};
}
const fr = langue('fr');
const en = langue('en');

const libelles = JSON.parse(
  fs.readFileSync(DEPOT + '/7ds-stats/libelles-stats.json', 'utf8'));
const metadonnees = JSON.parse(
  fs.readFileSync(DEPOT + '/7ds-stats/stat-metadata.json', 'utf8'));
const connus = new Set(
  [...Object.keys(libelles), ...Object.keys(metadonnees)].map(c => c.toLowerCase()));

/* Le jeu indexe ses stats en minuscules ; le depot emploie une casse que seul
   `Local_Key` porte. Sans lui, on ne saurait pas ecrire le code. */
function cleDuDepot(ligne, defaut) {
  const lk = String(ligne.Local_Key || '');
  if (!lk || lk === 'None') return defaut;
  return lk.startsWith('UI_') ? lk.slice(3) : lk;
}

const texte = (cle) => {
  if (!cle || cle === 'None') return null;
  const v = fr[cle] !== undefined ? fr[cle] : fr[String(cle).toLowerCase()];
  return v === undefined ? null : v;
};
const texteEn = (cle) => {
  if (!cle || cle === 'None') return null;
  const v = en[cle] !== undefined ? en[cle] : en[String(cle).toLowerCase()];
  return v === undefined ? null : v;
};

const nouvellesLibelles = {};
const nouvellesMeta = {};
const bornes = {};
let visibles = 0, caches = 0;
const sansNom = [];

for (const [brut, ligne] of Object.entries(statInfo)) {
  const code = cleDuDepot(ligne, brut);
  const type = String(ligne.Type || '').replace('EStatInfoType::', '');
  const groupeId = (ligne.GroupID && ligne.GroupID.String_Tid) || null;
  const taux = code.toLowerCase().endsWith('rate');

  /* 2. les bornes, pour toutes les stats sans exception.
     Indexees par le code DU JEU : deux stats peuvent partager un `Local_Key`
     — `maxsp_rate` et `recoverysp_rate` pointent tous deux `UI_MaxSP_Rate`,
     une erreur de la table — et la cle derivee en perdrait une. */
  bornes[brut] = {
    codeDepot: code,
    min: ligne.Min,
    max: ligne.Max,
    unite: taux ? 'ten-thousandths' : 'flat',
    type,
    groupe: groupeId,
    ordreUI: groupeId && groupes[groupeId]
      ? { emplacement: groupes[groupeId].UI_Location, priorite: groupes[groupeId].Priority }
      : null,
    priorite: ligne.Priority,
    equipe: ligne.Team === true,
    nameFr: texte(ligne.Local_Key),
    nameEn: texteEn(ligne.Local_Key),
  };

  // 1. les stats que le depot ignore
  if (connus.has(code.toLowerCase())) continue;
  if (type === 'Hide') { caches++; continue; }
  visibles++;

  const nomFr = texte(ligne.Local_Key);
  const nomEn = texteEn(ligne.Local_Key);
  /* Une entree de libelle sans libelle ne sert a rien et ferait afficher
     « null » au site. Les 12 concernees sont les familles Venom et Water :
     le schema les prevoit, aucune langue ne les nomme. Elles restent dans
     bornes-stats.json, ou l'absence de nom n'empeche rien. */
  if (!nomFr && !nomEn) { sansNom.push(code); continue; }
  nouvellesLibelles[code] = { fr: nomFr, en: nomEn, taux };
  nouvellesMeta[code] = {
    // La famille est une taxonomie du depot : elle ne se deduit pas du jeu.
    family: null,
    unit: taux ? 'ten-thousandths' : 'flat',
  };
}

function ecrire(nom, contenu) {
  const p = DEPOT + '/7ds-stats/' + nom;
  fs.writeFileSync(p, JSON.stringify(contenu, null, 1) + '\n', 'utf8');
  return nom;
}

// Tri alphabetique, comme les fichiers du depot.
const trier = (o) => Object.fromEntries(
  Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])));

ecrire('libelles-stats-nouvelles.json', trier(nouvellesLibelles));
ecrire('stat-metadata-nouvelles.json', trier(nouvellesMeta));
ecrire('bornes-stats.json', trier(bornes));

console.log('StatInfoTable : ' + Object.keys(statInfo).length + ' statistiques');
console.log('  connues du depot  : ' + (Object.keys(statInfo).length - visibles - caches));
console.log('  NOUVELLES visibles: ' + visibles + '   -> libelles-stats-nouvelles.json');
console.log('  nouvelles cachees : ' + caches + '   (Type=Hide, non ecrites)');
console.log('');
console.log('bornes-stats.json : ' + Object.keys(bornes).length + ' entrees');

if (sansNom.length) {
  console.log('');
  console.log('ECARTEES faute de libelle, dans aucune langue (' + sansNom.length + ') :');
  console.log('  ' + sansNom.join(', '));
  console.log('  -> familles Venom et Water : prevues par le schema, nommees nulle part.');
}

console.log('');
console.log('--- 20 nouvelles ---');
for (const [code, v] of Object.entries(trier(nouvellesLibelles)).slice(0, 20)) {
  console.log('  ' + code.padEnd(32) + String(v.fr || '?').slice(0, 42));
}

/* Les bornes qui comptent pour un calcul de degats : celles qui ne sont pas
   symetriques autour de zero, donc celles ou le moteur decide vraiment. */
console.log('');
console.log('--- planchers negatifs les plus serres ---');
Object.entries(bornes)
  .filter(([, b]) => b.min < 0 && b.min > -100000)
  .sort((a, b) => b[1].min - a[1].min)
  .slice(0, 12)
  .forEach(([c, b]) => console.log('  ' + c.padEnd(32)
    + String(b.min).padStart(9) + ' .. ' + String(b.max).padStart(10)
    + '   ' + String(b.nameFr || '').slice(0, 34)));
