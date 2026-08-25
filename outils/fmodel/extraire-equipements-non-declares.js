/* Tous les equipements dont le client connait les STATISTIQUES sans les
   declarer comme objets — armes, bijoux et armures confondus.

   Le pendant general de `extraire-gravees-non-declarees.js`, qui ne traite que
   les armures gravees et rend le format exact d'`armures-gravees.json`.

   POURQUOI ILS EXISTENT
     Le jeu livre en couches : `Option_StaticTable` et la localisation arrivent
     avant `ItemTable_Data_Equip`. Un objet peut donc avoir ses chiffres, son
     nom traduit et sa recette, sans etre encore jouable.

   TROIS STRUCTURES, SELON LA FAMILLE

     armes      `weapon_main1` + `weapon_main1_promotion` (+ `weapon_sub1`)
                GrowthType `promotionlv` : Value_Base est le socle, les
                Value_Add_1..5 le gain par niveau dans chaque palier de
                promotion. C'est la lecture que fait deja
                `verifier-stats-armes.js` sur les armes publiees.

     bijoux     `accessory_main1` + `_equiplv` + `_reinforce`

     armures    `armor_main1`/`main2`/`sub1`/`sub2` + `_equiplv` + `_reinforce`

   CE QU'ON N'A PAS
     Sans ligne d'objet : qualite, rarete, personnage, icone, grade, passifs
     d'equipement, options aleatoires. Laisses a null, jamais devines.

   Sortie : 7ds-stats/equipements-non-declares.json

   Lancer : node outils/fmodel/extraire-equipements-non-declares.js
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

const libelles = JSON.parse(
  fs.readFileSync(DEPOT + '/7ds-stats/libelles-stats.json', 'utf8'));
const metadonnees = JSON.parse(
  fs.readFileSync(DEPOT + '/7ds-stats/stat-metadata.json', 'utf8'));
const canonique = new Map();
for (const c of [...Object.keys(libelles), ...Object.keys(metadonnees)]) {
  canonique.set(c.toLowerCase(), c);
}

function codeStat(abilityType) {
  const brut = String(abilityType || '').replace(/^EAbilityType::/, '');
  if (!brut || brut === 'None') return null;
  return canonique.get(brut.toLowerCase()) || brut;
}

/* Le depot s'arrete a la premiere valeur nulle — voir verifier-stats-armes.js —
   la ou les armures elaguent des deux cotes. On respecte chaque convention. */
function progressionArme(ligne) {
  const p = [];
  for (let i = 1; i <= 7; i++) {
    const v = ligne['Value_Add_' + i];
    if (v === undefined || v === 0) break;
    p.push(v);
  }
  return p;
}
function progressionBordee(ligne) {
  const v = [];
  for (let i = 1; i <= 10; i++) v.push(ligne['Value_Add_' + i] || 0);
  let d = 0, f = v.length;
  while (d < f && v[d] === 0) d++;
  while (f > d && v[f - 1] === 0) f--;
  return v.slice(d, f);
}

function bloc(cle, famille) {
  const l = options[cle];
  if (!l) return null;
  return {
    base: l.Value_Base || 0,
    growthType: l.GrowthType || null,
    abilityType: codeStat(l.AbilityType),
    progression: famille === 'weapon' ? progressionArme(l) : progressionBordee(l),
  };
}

function materiaux(id) {
  const r = recettes[id];
  if (!r) return null;
  const s = [];
  for (let i = 1; i <= 7; i++) {
    const tid = r['Material_TID_' + i], cnt = r['Material_Cnt_' + i] || 0;
    if (!tid || tid === 'None' || !cnt) continue;
    s.push({ itemId: String(tid), quantity: cnt });
  }
  return s.length ? s : null;
}

// Les emplacements possibles, par famille.
const EMPLACEMENTS = {
  weapon: ['main1', 'main2', 'sub1', 'sub2'],
  accessory: ['main1', 'main2', 'sub1', 'sub2'],
  armor: ['main1', 'main2', 'sub1', 'sub2', 'sub3'],
};
// Les variantes accolees a un emplacement.
const VARIANTES = ['', '_promotion', '_equiplv', '_reinforce'];

const parFamille = new Map();
for (const cle of Object.keys(options)) {
  const m = /^(armor|weapon|accessory)_[a-z0-9_]*?(\d{6,})$/.exec(cle);
  if (!m || objets[m[2]]) continue;
  if (!parFamille.has(m[1])) parFamille.set(m[1], new Set());
  parFamille.get(m[1]).add(m[2]);
}

const sortie = [];
for (const [famille, ids] of [...parFamille].sort()) {
  for (const id of [...ids].sort()) {
    const emplacements = {};
    for (const e of EMPLACEMENTS[famille]) {
      const socle = options[famille + '_' + e + '_' + id];
      if (!socle) continue;
      const detail = { stat: codeStat(socle.AbilityType) };
      for (const v of VARIANTES) {
        const b = bloc(famille + '_' + e + v + '_' + id, famille);
        if (b) detail[v === '' ? 'statValues' : v.slice(1)] = b;
      }
      emplacements[e] = detail;
    }
    if (!Object.keys(emplacements).length) continue;

    sortie.push({
      gameId: id,
      famille,
      nameFr: fr['local_item_equip_name_' + id] || null,
      nameEn: en['local_item_equip_name_' + id] || null,
      descFr: fr['local_item_equip_desc_' + id] || null,
      emplacements,
      bindingMaterials: materiaux(id),
      provenance: {
        source: 'Option_StaticTable + Localization/Game/{fr,en} + MakingRecipe',
        absentDe: 'Item/ItemTable_Data_Equip',
        champsInconnus: ['qualite', 'rarete', 'personnage', 'icone', 'grade',
          'passifs', 'optionsAleatoires', 'promotion'],
      },
    });
  }
}

fs.writeFileSync(DEPOT + '/7ds-stats/equipements-non-declares.json',
  JSON.stringify(sortie, null, 1) + '\n', 'utf8');

const parFam = {};
const sansNom = [];
for (const e of sortie) {
  parFam[e.famille] = (parFam[e.famille] || 0) + 1;
  if (!e.nameFr) sansNom.push(e.gameId);
}
console.log('equipements non declares : ' + sortie.length);
for (const [f, n] of Object.entries(parFam)) console.log('   ' + f.padEnd(12) + n);
console.log('');
console.log('sans nom francais : ' + sansNom.length
  + (sansNom.length ? '  (' + sansNom.join(', ') + ')' : ''));
console.log('');
console.log('--- structures rencontrees ---');
const formes = new Map();
for (const e of sortie) {
  const f = e.famille + ' : ' + Object.keys(e.emplacements).join('+');
  formes.set(f, (formes.get(f) || 0) + 1);
}
[...formes].sort((a, b) => b[1] - a[1]).forEach(([f, n]) =>
  console.log('   ' + String(n).padStart(3) + ' x  ' + f));
console.log('');
console.log('ecrit dans 7ds-stats/equipements-non-declares.json');
