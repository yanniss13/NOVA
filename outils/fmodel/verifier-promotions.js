const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const promo = JSON.parse(fs.readFileSync(T + 'Item/ItemTable_Growth_Promotion.json', 'utf8'))[0].Rows;
const armes = require('c:/Users/yanni/Desktop/Site Confrérie 7ds/7ds-stats/armes.json');

const premier = Object.values(promo)[0];
console.log('colonnes de la table :', Object.keys(premier).join(', '));

// empreintes du jeu : niveau + cout + renforcement max + materiaux
function empreinteJeu(r) {
  const mats = (r.NeedItem || []).map(x => x.Item_ID + 'x' + x.Count).sort().join(',');
  return [r.PromotionLevel, r.Cost, r.MaxReinforce, mats].join('|');
}
const duJeu = new Set(Object.values(promo).map(empreinteJeu));
const niveauxJeu = new Set(Object.values(promo).map(r => r.PromotionLevel));
const coutsJeu = new Set(Object.values(promo).map(r => r.Cost));
console.log('lignes du jeu :', Object.keys(promo).length, '| empreintes distinctes :', duJeu.size);
console.log('niveaux :', [...niveauxJeu].sort((a, b) => a - b).join(', '));

// exemple brut d un NeedItem, pour caler la lecture
const avecItem = Object.values(promo).find(r => (r.NeedItem || []).length);
console.log('exemple de NeedItem :', JSON.stringify(avecItem ? avecItem.NeedItem : null).slice(0, 200));

// empreintes du site
function empreinteSite(s) {
  const mats = (s.materials || []).map(m => m.itemId + 'x' + m.quantity).sort().join(',');
  return [s.level, s.goldCost, s.reinforceMax, mats].join('|');
}
let total = 0, trouves = 0, coutOk = 0;
const absents = new Map();
for (const a of armes) {
  for (const g of a.grades || []) {
    for (const s of g.promotionSteps || []) {
      total++;
      if (duJeu.has(empreinteSite(s))) trouves++;
      else {
        const e = absents.get(empreinteSite(s)) || { n: 0, arme: a.nameFr, rarete: g.rarity, s };
        e.n++; absents.set(empreinteSite(s), e);
      }
      if (coutsJeu.has(s.goldCost)) coutOk++;
    }
  }
}
console.log('\npaliers de promotion cites par le site :', total);
console.log('  empreinte complete retrouvee :', trouves);
console.log('  cout en or retrouve          :', coutOk);
console.log('  empreintes introuvables      :', absents.size, 'distinctes');
[...absents.entries()].slice(0, 5).forEach(([k, v]) => console.log('    ' + v.arme + ' / ' + v.rarete + '  ' + k));
