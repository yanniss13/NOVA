/* Extrait les armures gravees dont le client connait les STATISTIQUES sans les
   declarer comme objets.

   Ces armures n'ont aucune ligne dans `Item/ItemTable_Data_Equip` — le correctif
   qui les active n'est pas arrive — mais `Item/Option_StaticTable` porte deja
   leurs valeurs, et la localisation leurs noms. Le jeu livre en couches.

   CE QUI EST DISPONIBLE, ET CE QUI NE L'EST PAS

     Option_StaticTable   mainStat, subStat, extraStats, toutes les progressions
     Localization         nameFr, nameEn, description
     MakingRecipe         bindingMaterials
     UIImg/.../BindArmor  iconUrl, deduit de l'identifiant (voir plus bas)

     ItemTable_Data_Equip  ABSENTE -> qualite, rarete, personnage, promotion,
                           passifs de gravure, options aleatoires restent a
                           null. Ne pas les inventer.

   La transcendance (renforcement +6 a +15) n'est PAS extractible : dans tout
   Option_StaticTable, aucune entree `_reinforce` ne porte de valeur dans
   Value_Add_6..10. Voir docs/extraction-fichiers-du-jeu.md.

   Sortie : 7ds-stats/armures-gravees-nouvelles.json, au format de
   7ds-stats/armures-gravees.json. Fichier SEPARE : les entrees sont
   incompletes, les fusionner dans le fichier vivant est une decision a part.

   Lancer : node outils/fmodel/extraire-gravees-non-declarees.js
*/
const fs = require('fs');
const path = require('path');

const EXPORTS = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content';
const DEPOT = path.resolve(__dirname, '..', '..');

function table(chemin) {
  const brut = JSON.parse(fs.readFileSync(EXPORTS + '/Table/' + chemin, 'utf8'));
  return (brut[0] && brut[0].Rows) || {};
}
function textes(langue) {
  const p = EXPORTS + '/Localization/Game/' + langue + '/Game.json';
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8')).client_language_table || {};
}

const options = table('Item/Option_StaticTable.json');
const objets = table('Item/ItemTable_Data_Equip.json');
const recettes = table('Making/MakingRecipe.json');
const fr = textes('fr');
const en = textes('en');

/* Le depot ecrit `B_MaxHp_Equip` la ou le jeu ecrit `B_MaxHP_Equip`, et
   `Ultimateskill_Damadd_Rate` pour `UltimateSkill_DamAdd_Rate`. Aucune regle
   mecanique ne relie les deux : on passe par les cles que le depot emploie
   deja, comparees sans tenir compte de la casse. */
const libelles = JSON.parse(
  fs.readFileSync(DEPOT + '/7ds-stats/libelles-stats.json', 'utf8'));
const metadonnees = JSON.parse(
  fs.readFileSync(DEPOT + '/7ds-stats/stat-metadata.json', 'utf8'));
const canonique = new Map();
for (const cle of [...Object.keys(libelles), ...Object.keys(metadonnees)]) {
  canonique.set(cle.toLowerCase(), cle);
}
const inconnus = new Set();

function codeStat(abilityType) {
  const brut = String(abilityType || '').replace(/^EAbilityType::/, '');
  if (!brut || brut === 'None') return null;
  const trouve = canonique.get(brut.toLowerCase());
  if (!trouve) inconnus.add(brut);
  return trouve || brut;
}

function libelle(code) {
  const l = libelles[code];
  return l ? { nameEn: l.en || null, nameFr: l.fr || null } : { nameEn: null, nameFr: null };
}

/* Les progressions du jeu vivent dans Value_Add_1..10 et sont bordees de zeros.
   La position n'est pas une donnee : un `equiplv_15` range toujours sa valeur
   unique en Value_Add_2, et le depot n'en garde que la valeur — verifie sur les
   85 armures deja publiees. On ne conserve donc que la plage renseignee, tete
   et queue elaguees. Les `reinforce`, qui remplissent Value_Add_1..5, en
   sortent inchanges. */
function progression(ligne) {
  const v = [];
  for (let i = 1; i <= 10; i++) v.push(ligne['Value_Add_' + i] || 0);
  let debut = 0, fin = v.length;
  while (debut < fin && v[debut] === 0) debut++;
  while (fin > debut && v[fin - 1] === 0) fin--;
  return v.slice(debut, fin);
}

function bloc(cle) {
  const ligne = options[cle];
  if (!ligne) return null;
  return {
    base: ligne.Value_Base || 0,
    growthType: ligne.GrowthType || null,
    abilityType: codeStat(ligne.AbilityType),
    progression: progression(ligne),
  };
}

function emplacement(prefixe, id) {
  const socle = options[prefixe + '_' + id];
  if (!socle) return null;
  const code = codeStat(socle.AbilityType);
  return {
    code,
    reinforce: bloc(prefixe + '_reinforce_' + id),
    equiplvAdd: bloc(prefixe + '_equiplv_' + id),
    statValues: bloc(prefixe + '_' + id),
  };
}

/* L'icone se deduit de l'identifiant, regle apprise sur les 85 armures
   declarees et verifiee sur elles : `IconName` vaut
   `icon_bindarmor_<heros>_<type>_<code>`, ou <code> est exactement les quatre
   derniers chiffres de l'identifiant (85/85), et <heros> se lit sur les deux
   chiffres qui precedent (index 01 = tristan ... 41 = derieri).
   Le type se deduit du code : 5001 cloth, 5002 leather, 5003 plate ; 4001
   prend les trois. */
const ICONES_DIR = EXPORTS + '/UIImg/Icon_Item/BindArmor';
const fichiersIcone = new Map();
if (fs.existsSync(ICONES_DIR)) {
  for (const f of fs.readdirSync(ICONES_DIR)) {
    if (f.toLowerCase().endsWith('.png')) fichiersIcone.set(f.slice(0, -4).toLowerCase(), f);
  }
}
const herosParIndex = new Map();
const typesParCode = new Map();
for (const [id, v] of Object.entries(objets)) {
  if (!id.startsWith('133')) continue;
  const m = /^icon_bindarmor_(.+)_([a-z]+)_(\d{4})$/.exec(String(v.IconName || ''));
  if (!m) continue;
  herosParIndex.set(id.slice(3, 5), m[1]);
  if (!typesParCode.has(m[3])) typesParCode.set(m[3], new Set());
  typesParCode.get(m[3]).add(m[2]);
}

function icone(id) {
  const heros = herosParIndex.get(id.slice(3, 5));
  if (!heros) return null;              // heros inconnu : ne rien inventer
  const code = id.slice(5, 9);
  const types = [...(typesParCode.get(code) || ['cloth', 'leather', 'plate'])];
  for (const t of types) {
    const nom = (heros + '_' + t + '_' + code).toLowerCase();
    if (fichiersIcone.has(nom)) return 'UIImg/Icon_Item/BindArmor/' + fichiersIcone.get(nom);
  }
  return null;
}

function materiaux(id) {
  const r = recettes[id];
  if (!r) return null;
  const sortie = [];
  for (let i = 1; i <= 7; i++) {
    const tid = r['Material_TID_' + i];
    const cnt = r['Material_Cnt_' + i] || 0;
    if (!tid || tid === 'None' || !cnt) continue;
    sortie.push({ itemId: String(tid), quantity: cnt });
  }
  return sortie.length ? sortie : null;
}

/* Les armures gravees se reconnaissent au prefixe 133 de leur identifiant.
   On retient celles qu'Option_StaticTable connait et qu'ItemTable_Data_Equip
   ignore. */
const identifiants = new Set();
for (const cle of Object.keys(options)) {
  const m = /^armor_[a-z0-9_]*?(\d{6,})$/.exec(cle);
  if (m && m[1].startsWith('133') && !objets[m[1]]) identifiants.add(m[1]);
}

const sortie = [];
for (const id of [...identifiants].sort()) {
  const main1 = emplacement('armor_main1', id);
  if (!main1) continue;
  const main2 = emplacement('armor_main2', id);
  const sub1 = emplacement('armor_sub1', id);

  const extraStats = [];
  for (const [prefixe, slot] of [['armor_main2', 'main'], ['armor_sub2', 'sub'],
                                 ['armor_sub3', 'sub']]) {
    const e = emplacement(prefixe, id);
    if (!e) continue;
    const meta = metadonnees[e.code] || {};
    extraStats.push({
      key: e.code,
      slot,
      isRate: meta.unit === 'ten-thousandths',
      ...libelle(e.code),
      reinforce: e.reinforce,
      equiplvAdd: e.equiplvAdd,
      statValues: e.statValues,
    });
  }

  sortie.push({
    gameId: id,
    mainStat: main1.code,
    subStat: sub1 ? sub1.code : null,
    // Sans ligne d'objet, la qualite est inconnue. Ne pas deviner.
    qualityMin: null, qualityMax: null,
    qualityMinLive: null, qualityMaxLive: null,
    tierBoundaries: null,
    growth: {
      promotion: null,
      extraStats,
      subReinforce: sub1 ? sub1.reinforce : null,
      subStatLabel: sub1 ? libelle(sub1.code) : null,
      mainReinforce: main1.reinforce,
      mainStatLabel: libelle(main1.code),
      randomOptions: null,
    },
    personnage: null,
    personnageNomFr: null,
    costumeSlug: null,
    nameFr: fr['local_item_equip_name_' + id] || null,
    nameEn: en['local_item_equip_name_' + id] || null,
    descFr: fr['local_item_equip_desc_' + id] || null,
    rarity: null,
    effectNameFr: null,
    engravingPassives: null,
    bindingMaterials: materiaux(id),
    iconUrl: icone(id),
    provenance: {
      source: 'Option_StaticTable + Localization/Game/{fr,en} + MakingRecipe',
      absentDe: 'Item/ItemTable_Data_Equip',
      champsInconnus: ['qualityMin', 'qualityMax', 'tierBoundaries', 'rarity',
        'personnage', 'costumeSlug', 'engravingPassives',
        'randomOptions', 'growth.promotion']
        .concat(icone(id) ? [] : ['iconUrl']),
      transcendance: 'absente du client : Value_Add_6..10 valent 0 partout',
    },
  });
}

const destination = DEPOT + '/7ds-stats/armures-gravees-nouvelles.json';
fs.writeFileSync(destination, JSON.stringify(sortie, null, 1) + '\n', 'utf8');

console.log('armures gravees non declarees : ' + sortie.length);
console.log('');
console.log('id           nom                                   mainStat            sub   extra  mat   icone');
for (const e of sortie) {
  console.log(
    e.gameId.padEnd(12),
    String(e.nameFr || '?').slice(0, 36).padEnd(38),
    String(e.mainStat).padEnd(20),
    (e.subStat ? 'oui' : '-').padEnd(6),
    String(e.growth.extraStats.length).padEnd(6),
    e.bindingMaterials ? e.bindingMaterials.length : 0,
    e.iconUrl ? 'icone' : '-');
}
if (inconnus.size) {
  console.log('');
  console.log('codes de stat absents du vocabulaire du depot : ' + [...inconnus].join(', '));
}
console.log('');
console.log('ecrit dans 7ds-stats/armures-gravees-nouvelles.json');
