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
const costumes = table('/Table/CostumeTable.json');
const equipements = table('/Table/Item/ItemTable_Data_Equip.json');

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
require(DEPOT + '/data/stats-build.js');
const slugsDuSite = new Set(Object.keys(global.window.SEVEN_DS_META || {}));

/* LA TENUE QUI PORTE LA TRANSCENDANCE

   Une transcendance n'est active que si la tenue qui l'a donnee est PORTEE
   (regle du jeu, confirmee par un joueur le 27 aout 2026). Le catalogue doit
   donc dire laquelle, sans quoi il reste decoratif.

   Le lien ne se lit pas d'un trait, mais il est deterministe — aucun
   rapprochement par nom, qui echouerait sur les doublons comme « Sortie
   decontractee », portee par deux heros :

     engravedByFile[fichier].slug   ->  ban-costume-134102102
     CostumeTable (ligne ItemId)    ->  Open_Condition_Value = 133274001
     ItemTable_Data_Equip           ->  LimitBreak_Passive = EpLb_Ban_B

   `PromotionLevel` vaut 3 partout : la transcendance ne s'active qu'une fois
   la piece promue au dernier palier. Le champ est publie plutot que code en
   dur, pour qu'un patch qui l'abaisse se voie dans le diff. */
const parCostume = {};
for (const ligne of Object.values(costumes)) {
  parCostume[String(ligne.ItemId)] = ligne;
}

/* CHAQUE TRANSCENDANCE VA AVEC UNE ARME, ET UNE SEULE.

   `BindArmor_RecommendEquip_WeaponType` porte le type d'arme de la tenue. La
   correspondance est une BIJECTION verifiee sur les 26 heros : leurs trois
   tenues transcendables visent leurs trois armes, jamais deux fois la meme.
   Ban : nunchaku, epee a deux mains, gantelets — et l'effet colle a chaque
   fois au kit de l'arme (l'ultime au nunchaku, la competence normale a
   l'epee, le buff de Tenebres d'equipe aux gantelets).

   MAIS L'ARME N'EST QU'UNE RECOMMANDATION. Tranche par un joueur le 27 aout
   2026 : le passif de transcendance est lie A LA TENUE, pas a l'arme. Porter
   « Cuisinier remplacant » avec les gantelets garde donc les +50 % d'ultime.
   Le nom du champ le disait deja — « Recommend » — et les tables le
   confirmaient : le passif ne porte aucune condition d'arme, et les effets
   sont generiques (toutes les armes ont un ultime).

   On publie donc l'arme comme un REPERE, jamais comme une condition de
   calcul : `dps-effets.js` applique le bonus des que la tenue est portee au
   renforcement maximal, quelle que soit l'arme. */
const ARMES_DU_SITE = {};
for (const heros of Object.values(global.window.SEVEN_DS_META || {})) {
  for (const slot of heros.weapons || []) {
    if (slot && slot.weapon) ARMES_DU_SITE[slot.weapon.toLowerCase()] = slot.weapon;
  }
}

const tenueParTranscendance = {};
for (const [fichier, tenue] of Object.entries(
  global.window.SEVEN_DS_BUILD_STATS.engravedByFile || {}
)) {
  const decoupe = String(tenue.slug || '').match(/-costume-(\d+)$/);
  if (!decoupe) continue;
  const costume = parCostume[decoupe[1]];
  if (!costume) continue;
  const equipement = equipements[(costume.Open_Condition_Value || [])[0]];
  const limite = equipement && (equipement.LimitBreak_Passive || [])[0];
  if (!limite) continue;
  const brute = (equipement.BindArmor_RecommendEquip_WeaponType || [])[0];
  tenueParTranscendance[String(limite.EquipPassiveID).toLowerCase()] = {
    tenue: fichier,
    promotion: limite.PromotionLevel,
    arme: ARMES_DU_SITE[String(brute || '').toLowerCase()] || null
  };
}

/* LA REGLE DPS D'UNE TRANSCENDANCE

   Le jeu ne publie PAS la statistique touchee. `SkillTable` ne contient qu'une
   coquille vide de passif, et `BuffTable` n'en cite qu'une sur trois, sans
   ligne d'abilite : le calcul est cote serveur. Seule la phrase francaise dit
   a quoi le nombre se rapporte.

   D'ou cette table de CINQ phrases, la seule interpretation de ce fichier.
   Elle est ancree sur la phrase ENTIERE (^...$) et non sur un fragment : sans
   cela, « Augmente les degats des Tenebres de tous les heros allies de 30% »
   passerait pour un bonus au heros.

   Ce qu'elle ne reconnait pas n'a PAS de regle, et le compte final le dit.
   Un patch qui reformule une phrase fera donc baisser ce compte au lieu de
   publier un bonus muet — tests/transcendances-catalogue.test.js le refuse. */
const CIBLE_PAR_PHRASE = [
  ["Augmente les dégâts de compétence normale de ", "normal-skill"],
  ["Augmente les dégâts d'attaque ultime de ", "ultimate"],
  ["Augmente les dégâts d'attaque spéciale de ", "special"],
  ["Augmente les dégâts d'attaque normale de ", "normal"],
  ["Augmente les dégâts de compétence de relève de ", "tag-skill"]
];

/* La valeur est stockee en dix-milliemes, comme partout ailleurs dans le
   comparateur : 50 % s'ecrit 5000. */
function regleDe(texte) {
  for (const [phrase, cible] of CIBLE_PAR_PHRASE) {
    const motif = new RegExp(
      '^' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + '(\\d+(?:[.,]\\d+)?)%\\.$'
    );
    const trouve = texte.match(motif);
    if (!trouve) continue;
    return {
      cible,
      valeur: Math.round(parseFloat(trouve[1].replace(',', '.')) * 100),
      phrase
    };
  }
  return null;
}

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

  const porteuse = tenueParTranscendance[cle];
  if (!porteuse) { trous.push(cle + ' : aucune tenue gravee ne la donne'); continue; }
  if (!porteuse.arme) { trous.push(cle + " : aucun type d'arme sur sa tenue"); continue; }

  (parHeros[slug] = parHeros[slug] || []).push({
    rang: decoupe[2], id: cle, nom, texte,
    tenue: porteuse.tenue, promotion: porteuse.promotion,
    arme: porteuse.arme,
    regle: regleDe(texte)
  });
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
// Le champ « tenue » est la tenue gravee qui donne la transcendance, sous la
// cle de engravedByFile (data/stats-build.js). Elle n'est ACTIVE QUE SI CETTE
// TENUE EST PORTEE, et une fois la piece promue au palier « promotion ».
// Sans ce lien, le catalogue ne serait qu'un texte a lire.
//
// Les valeurs sont deja substituees dans les descriptions : le jeu les tient
// a part du gabarit, et un « {0} » survivant serait une substitution manquee.
// tests/transcendances-catalogue.test.js le refuse.
`;

const corps = heros.map(slug => {
  const lignes = parHeros[slug].map(entree =>
    '    { id:' + JSON.stringify(entree.id)
    + ', nom:' + JSON.stringify(entree.nom)
    + ', texte:' + JSON.stringify(entree.texte)
    + ',\n      tenue:' + JSON.stringify(entree.tenue)
    + ', promotion:' + JSON.stringify(entree.promotion)
    + ', arme:' + JSON.stringify(entree.arme)
    + (entree.regle
      ? ',\n      regle:{ cible:' + JSON.stringify(entree.regle.cible)
        + ', valeur:' + entree.regle.valeur
        + ', phrase:' + JSON.stringify(entree.regle.phrase) + ' }'
      : '')
    + ' }'
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

/* Le compte des regles est la mesure a surveiller entre deux extractions.
   S'il baisse, une phrase a change de tournure et un bonus est passe a la
   trappe en silence — c'est le seul defaut que ce fichier peut avoir. */
const avecRegle = Object.values(parHeros)
  .reduce((somme, liste) => somme + liste.filter(e => e.regle).length, 0);
console.log('dont regle DPS   : ' + avecRegle
  + '  (le reste vise l\'equipe ou la cible)');
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
