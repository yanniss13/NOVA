/* Les transcendances — les passifs de Limit Break arrives avec la version 2.0
   du jeu, le 26 aout 2026.

   POURQUOI CE FICHIER EXISTE

   7dsorigin.app ne publie pas les transcendances, et SevenCodex non plus. Le
   client, lui, les porte en clair : `ItemTable_Equip_Passive_Base` donne le
   nom de chacune, `ItemTable_Equip_Passive_Group` sa description et ses
   valeurs, et `Localization/Game/fr/Game.json` le texte francais.

   Chaque heros en a exactement trois, suffixees _b, _c et _d. Le suffixe _a
   n'existe pas : ce n'est pas un trou, la serie commence a _b.

   LES VALEURS SONT DANS `Local_Replace`, PAS DANS LE TEXTE

   La description publiee est un gabarit — « Augmente les degats de {0} » — et
   les nombres vivent a cote, sous la forme `{0}:{50%}`. Les substituer est
   donc la seule facon d'obtenir une phrase juste, et un `{0}` survivant dans
   la sortie signale une substitution manquee. Le test du catalogue le refuse.

   Sortie : data/transcendances.js
   Lancer : node outils/fmodel/extraire-transcendances.js
*/
const fs = require('fs');
const path = require('path');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';
const DEPOT = path.resolve(__dirname, '..', '..');

function table(chemin) {
  const brut = JSON.parse(fs.readFileSync(EXPORTS + chemin, 'utf8'));
  const objet = Array.isArray(brut) ? brut[0] : brut;
  return objet.Rows || {};
}

const base = table('/Table/Item/ItemTable_Equip_Passive_Base.json');
const groupes = table('/Table/Item/ItemTable_Equip_Passive_Group.json');

/* La table de localisation francaise. Les cles y sont ecrites tantot en
   capitales, tantot en minuscules selon la table qui les cite : on indexe
   en minuscules une fois pour toutes plutot que de deviner a chaque appel. */
const localisation = JSON.parse(fs.readFileSync(
  EXPORTS + '/Localization/Game/fr/Game.json', 'utf8')).client_language_table;
const index = {};
for (const cle of Object.keys(localisation)) {
  index[cle.toLowerCase()] = localisation[cle];
}
const traduire = cle => index[String(cle || '').toLowerCase()];

/* Le seul heros dont l'identifiant du jeu differe du slug du site. Une entree
   ici plutot qu'une regle : le jour ou un deuxieme cas apparait, il se voit. */
const ALIAS = { gilthunder: 'gil-thunder' };

/* Les slugs que le site connait. Une transcendance qui ne s'y rattache pas est
   une erreur, pas un detail : elle serait publiee sans jamais s'afficher. */
global.window = {};
require(DEPOT + '/data/personnages-meta.js');
const slugsDuSite = new Set(Object.keys(global.window.SEVEN_DS_META || {}));

/* Substitue les valeurs et retire les balises de couleur du jeu, qui ne
   veulent rien dire hors de son interface. */
function rendre(texte, remplacements) {
  let sortie = String(texte || '');
  (remplacements || []).forEach(regle => {
    const decoupe = regle.match(/^\{(\d+)\}:\{(.*)\}$/);
    if (decoupe) sortie = sortie.split('{' + decoupe[1] + '}').join(decoupe[2]);
  });
  return sortie
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

const parHeros = {};
const orphelins = [];
const trous = [];

for (const [cle, ligne] of Object.entries(base)) {
  const decoupe = cle.match(/^eplb_([a-z0-9]+)_([a-z])$/);
  if (!decoupe) continue;

  const slug = ALIAS[decoupe[1]] || decoupe[1];
  if (!slugsDuSite.has(slug)) { orphelins.push(cle); continue; }

  const groupe = Object.values(groupes).find(g => g.GroupID === ligne.GroupID);
  if (!groupe) { trous.push(cle + ' : aucun groupe ' + ligne.GroupID); continue; }

  const nom = traduire(ligne.Core_Name);
  const texte = rendre(traduire(groupe.Desc), groupe.Local_Replace);
  if (!nom) { trous.push(cle + ' : nom non traduit (' + ligne.Core_Name + ')'); continue; }
  if (!texte) { trous.push(cle + ' : description non traduite (' + groupe.Desc + ')'); continue; }

  (parHeros[slug] = parHeros[slug] || []).push({ rang: decoupe[2], id: cle, nom, texte });
}

for (const liste of Object.values(parHeros)) {
  liste.sort((a, b) => a.rang.localeCompare(b.rang));
  liste.forEach(entree => { delete entree.rang; });
}

const heros = Object.keys(parHeros).sort();
const total = heros.reduce((somme, slug) => somme + parHeros[slug].length, 0);

const entete = `// Les transcendances : les passifs de Limit Break de chaque heros.
//
// GENERE — ne pas editer a la main :
//     node outils/fmodel/extraire-transcendances.js
//
// La source n'est ni 7dsorigin.app ni SevenCodex, qui ne les publient pas,
// mais l'extraction locale du client (FModel). La CI ne peut donc PAS
// regenerer ce fichier : le commit fait foi, comme pour data/competences.js.
// A refaire apres chaque nouvel export du jeu.
//
// Cle = slug du personnage, celui de personnages-meta.js.
// Trois transcendances par heros, dans l'ordre du jeu.
//
// Les valeurs sont deja substituees dans les descriptions : le jeu les tient
// a part du gabarit, et un « {0} » survivant serait une substitution manquee.
// tests/transcendances-catalogue.test.js le refuse.
`;

const corps = heros.map(slug => {
  const lignes = parHeros[slug].map(entree =>
    '    { id:' + JSON.stringify(entree.id)
    + ', nom:' + JSON.stringify(entree.nom)
    + ', texte:' + JSON.stringify(entree.texte) + ' }'
  ).join(',\n');
  return '  ' + JSON.stringify(slug) + ':[\n' + lignes + '\n  ]';
}).join(',\n');

fs.writeFileSync(
  DEPOT + '/data/transcendances.js',
  entete + 'window.SEVEN_DS_TRANSCENDANCES = {\n' + corps + '\n};\n',
  'utf8'
);

console.log('heros couverts   : ' + heros.length);
console.log('transcendances   : ' + total);
if (orphelins.length) {
  console.log('\nignores, slug inconnu du site : ' + orphelins.join(', '));
}
if (trous.length) {
  console.log('\n--- INCOMPLETS, a corriger ---');
  trous.forEach(t => console.log('   ' + t));
}
const sansTrois = heros.filter(slug => parHeros[slug].length !== 3);
if (sansTrois.length) {
  console.log('\nheros qui n\'ont pas trois transcendances : ' + sansTrois.join(', '));
}
console.log('\necrit dans data/transcendances.js');
