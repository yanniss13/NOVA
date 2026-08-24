/* Les statistiques DEFENSIVES d'un monstre, par son nom francais.

   Pour le retro-engineering de la formule de degats : defense, resistances
   elementaires, faiblesses, resistance critique, percement, absorption.

   LE CHEMIN DANS LES DONNEES

     Localization/Game/fr    « Lapin mutilateur rapide » -> local_mon_name_rabbit_0001
     Actor/MonsterActorTable ce nom -> StatGroupTid (« stat_1234 »)
     Actor/NpcStatGroupTable ce groupe -> les 100 statistiques

   LE MAILLON MANQUANT, au 24 aout 2026 : `Actor/MonsterActorTable` fait partie
   des 37 tables que le usmap `mappings-1.7` ne sait pas decoder. Elle sort
   vide, et sans elle rien ne relie un nom a un groupe. Le reste est pret :
   `NpcStatGroupTable` est lisible et porte ses 1 020 groupes.

   Le script dit franchement lequel des deux maillons manque plutot que de
   rendre une liste vide.

   Lancer : node outils/fmodel/stats-monstres.js "lapin mutilateur rapide" "cache-cache"
            node outils/fmodel/stats-monstres.js --groupe stat_1234
*/
const fs = require('fs');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';

function table(chemin) {
  try {
    const brut = JSON.parse(fs.readFileSync(EXPORTS + '/Table/' + chemin, 'utf8'));
    return (brut[0] && brut[0].Rows) || {};
  } catch (erreur) {
    return {};
  }
}

const textes = JSON.parse(
  fs.readFileSync(EXPORTS + '/Localization/Game/fr/Game.json', 'utf8')
).client_language_table;
const monstres = table('Actor/MonsterActorTable.json');
const npc = table('Actor/NPCActorTable.json');
const groupes = table('Actor/NpcStatGroupTable.json');

/* Ce qui interesse un calcul de degats subis. L'ordre est celui de la lecture,
   pas celui de la table : on veut voir la defense avant le detail elementaire. */
const ELEMENTS = ['Thunder', 'Wind', 'Fire', 'Ice', 'Earth', 'Dark', 'Holy',
  'Venom', 'Water'];
const DEFENSIVES = [
  ['B_MaxHp', 'PV'],
  ['B_Def', 'Défense'],
  ['B_Atk', 'Attaque'],
  ['I_DefAdd_Rate', 'Augmentation de la défense'],
  ['D_All_DamRes_Rate', 'Réduction de tous les dégâts'],
  ['D_Normal_DamRes_Rate', 'Réduction des dégâts normaux'],
  ['D_DamAbs_Rate', 'Absorption'],
  ['D_Protect_CurRes_Rate', 'Résistance au percement'],
  ['C_Critical_ResRate', 'Résistance critique'],
  ['C_Critical_DamRes_Rate', 'Défense critique'],
  ['A_Block', 'Blocage'],
  ['A_Block_Rate', 'Taux de blocage'],
  ['D_Block_DamRes_Rate', 'Réduction des dégâts bloqués'],
  ['Burst_Gauge_Res_Rate', 'Résistance à la jauge de Déluge']
];

function normaliser(texte) {
  return String(texte || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Tous les noms de monstres du jeu, indexes par nom francais normalise. */
function catalogueDesNoms() {
  const parNom = new Map();
  for (const [cle, valeur] of Object.entries(textes)) {
    if (!/^local_(mon|npc)_name_/i.test(cle)) continue;
    parNom.set(normaliser(valeur), { cle, nom: valeur });
  }
  return parNom;
}

/* Le groupe de statistiques d'un monstre, en cherchant sa ligne par sa clé de
   localisation. Les deux tables sont interrogees : certains « monstres » sont
   declares comme NPC. */
function groupeDuMonstre(cleDeNom) {
  for (const source of [monstres, npc]) {
    for (const [ligne, valeur] of Object.entries(source)) {
      const local = String(valeur.Local_Key || '').toLowerCase();
      if (local !== cleDeNom.toLowerCase()) continue;
      return { ligne, groupe: valeur.StatGroupTid };
    }
  }
  return null;
}

function afficherGroupe(nomGroupe) {
  const stats = groupes[nomGroupe];
  if (!stats) {
    console.log('  groupe introuvable dans NpcStatGroupTable : ' + nomGroupe);
    return;
  }
  const dit = (code, libelle) => {
    const v = stats[code];
    if (v === undefined || v === 0) return;
    /* Les taux du jeu sont en dix-milliemes : 1500 vaut 15 %. */
    const suffixe = /_Rate$|_ResRate$|_Res$/.test(code)
      ? '  (' + (v / 100) + ' %)' : '';
    console.log('    ' + libelle.padEnd(34) + String(v).padStart(9) + suffixe);
  };
  console.log('  -- defensif --');
  for (const [code, libelle] of DEFENSIVES) dit(code, libelle);
  console.log('  -- resistance elementaire (points) --');
  for (const e of ELEMENTS) dit(e + '_Res', e);
  console.log('  -- resistance elementaire (taux) --');
  dit('Default_Element_Res_Rate', 'Physique');
  for (const e of ELEMENTS) dit(e + '_Element_Res_Rate', e);
  console.log('  -- faiblesses --');
  dit('Default_Weakness_Rate', 'Physique');
  for (const e of ELEMENTS) dit(e + '_Weakness_Rate', e);
}

const argv = process.argv.slice(2);
console.log('MonsterActorTable : ' + Object.keys(monstres).length + ' lignes'
  + ' | NPCActorTable : ' + Object.keys(npc).length + ' lignes'
  + ' | NpcStatGroupTable : ' + Object.keys(groupes).length + ' groupes');

if (argv[0] === '--groupe') {
  console.log('\n== ' + argv[1]);
  afficherGroupe(argv[1]);
  return;
}

if (!Object.keys(monstres).length && !Object.keys(npc).length) {
  console.log('\nMonsterActorTable et NPCActorTable sortent VIDES : le usmap ne');
  console.log('sait pas les decoder. Le journal le confirme —');
  console.log('  Output/Logs/FModel-Log-<date>.log : « Could not read DataTable correctly »');
  console.log('Sans elles, aucun nom ne mene a un groupe. Les 1 020 groupes,');
  console.log("eux, sont lisibles : `--groupe stat_1234` les affiche des qu'on");
  console.log('connait le numero.');
}

const parNom = catalogueDesNoms();
for (const demande of argv) {
  const cle = normaliser(demande);
  const trouve = parNom.get(cle);
  console.log('\n== ' + demande);
  if (!trouve) {
    const proches = [...parNom.entries()]
      .filter(([nom]) => nom.includes(cle) || cle.includes(nom))
      .slice(0, 5);
    console.log('  nom introuvable dans la localisation francaise.'
      + (proches.length ? ' Proches : '
        + proches.map(([, v]) => v.nom).join(', ') : ''));
    continue;
  }
  console.log('  ' + trouve.nom + '  (' + trouve.cle + ')');
  const lien = groupeDuMonstre(trouve.cle);
  if (!lien) {
    console.log('  aucune ligne d acteur ne porte ce nom : maillon manquant.');
    continue;
  }
  console.log('  acteur ' + lien.ligne + ' -> groupe ' + lien.groupe);
  afficherGroupe(lien.groupe);
}
