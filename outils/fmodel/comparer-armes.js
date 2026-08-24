const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const table = (r) => JSON.parse(fs.readFileSync(T + r, 'utf8'))[0].Rows;

const heroMastery = table('HeroMastery/HeroMastery.json');
const wm = table('HeroMastery/HeroWeaponMastery.json');
const groupes = table('HeroMastery/HeroWeaponMasteryGroup.json');
const groupExp = table('HeroMastery/HeroWeaponMasteryGroupExp.json');
const site = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/personnages.json');

const ALIAS = { Dreydrin: 'Dredrin', Klotho: 'Clotho', Manny: 'Mannie', Slader: 'Slater' };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const parNom = new Map(site.map(p => [norm(p.nameEn), p]));

// type d arme par identifiant de maitrise ; EndWeapon est une valeur sentinelle, on l ignore
const typeParTid = {};
for (const r of Object.values(wm)) {
  const tid = String(r.Weapon_Mastery_Tid);
  const t = norm(String(r.Weapon_Type).replace('EItemDivision::', ''));
  if (!t || t === 'endweapon' || t === 'none') continue;
  if (!typeParTid[tid]) typeParTid[tid] = t;
}
// sous-paliers par groupe
const expParGroupe = {};
for (const r of Object.values(groupExp)) {
  const g = String(r.WeaponGroupTid);
  (expParGroupe[g] || (expParGroupe[g] = [])).push({
    index: r.WeaponGroupEXP_Index,
    exp: r.Mastery_Exp_Value,
    abilities: (r.Mastery_AbilityType || []).map((t, i) => ({
      stat: String(t).replace('EAbilityType::', ''),
      value: (r.Mastery_AbilityValue || [])[i],
    })),
  });
}
for (const g of Object.values(expParGroupe)) g.sort((a, b) => a.index - b.index);

let nbEntrees = 0, nbEcarts = 0, herosAvecEcart = 0;
const detail = [];

for (const [id, r] of Object.entries(heroMastery)) {
  const nomJeu = String(r.String_Tid || '').replace(/_SpecialMastery_Reward$/, '');
  const p = parNom.get(norm(ALIAS[nomJeu] || nomJeu));
  if (!p) continue;

  const lignes = [];
  // le type d arme de chaque emplacement est donne par l icone du heros ;
  // la table des maitrises ne le porte pas toujours.
  const emplacements = [
    [String(r.Weapon_1_Mastery_Tid), norm(String(r.Weapon_1_Mastery_Icon || '').replace('icon_mastery_', ''))],
    [String(r.Weapon_2_Mastery_Tid), norm(String(r.Weapon_2_Mastery_Icon || '').replace('icon_mastery_', ''))],
    [String(r.Weapon_3_Mastery_Tid), norm(String(r.Weapon_3_Mastery_Icon || '').replace('icon_mastery_', ''))],
  ];

  for (const [tid, typeIcone] of emplacements) {
    const type = typeParTid[tid] || typeIcone;
    for (let pal = 0; pal < 5; pal++) {
      const gTid = tid + String(pal).padStart(2, '0');
      if (!groupes[gTid]) continue;
      const niveau = groupes[gTid].Weapon_Mastery_Group_Index;
      const attendus = expParGroupe[gTid] || [];

      const entree = (p.weaponMasteries || []).find(w => norm(w.weaponType) === type && w.level === niveau);
      nbEntrees++;
      if (!entree) { lignes.push(type + ' palier ' + niveau + ' : absent du site (present dans le jeu)'); nbEcarts++; continue; }

      const sousSite = entree.subLevels || [];
      if (sousSite.length !== attendus.length) {
        lignes.push(type + ' palier ' + niveau + ' : ' + sousSite.length + ' sous-paliers sur le site, ' + attendus.length + ' dans le jeu');
        nbEcarts++;
        continue;
      }
      for (let i = 0; i < attendus.length; i++) {
        const a = attendus[i], s = sousSite[i];
        if (a.exp !== s.exp) { lignes.push(type + ' p' + niveau + '.' + (i + 1) + ' exp : site=' + s.exp + ' jeu=' + a.exp); nbEcarts++; }
        const ab = a.abilities, sb = s.abilities || [];
        if (ab.length !== sb.length) { lignes.push(type + ' p' + niveau + '.' + (i + 1) + ' : ' + sb.length + ' gains sur le site, ' + ab.length + ' dans le jeu'); nbEcarts++; continue; }
        for (let k = 0; k < ab.length; k++) {
          if (ab[k].stat !== sb[k].stat || ab[k].value !== sb[k].value) {
            lignes.push(type + ' p' + niveau + '.' + (i + 1) + ' : site=' + sb[k].stat + '/' + sb[k].value + '  jeu=' + ab[k].stat + '/' + ab[k].value);
            nbEcarts++;
          }
        }
      }
    }
  }
  if (lignes.length) { herosAvecEcart++; detail.push([p.nameFr + ' (' + p.slug + ')', lignes]); }
}

for (const [nom, lignes] of detail) {
  console.log('\n' + nom + ' — ' + lignes.length + ' ecart(s)');
  lignes.slice(0, 12).forEach(l => console.log('   ' + l));
  if (lignes.length > 12) console.log('   … et ' + (lignes.length - 12) + ' autres');
}
console.log();
console.log('entrees comparees :', nbEntrees, '| ecarts :', nbEcarts, '| heros concernes :', herosAvecEcart + '/25');
