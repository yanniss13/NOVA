const fs = require('fs');
const RACINE = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const rel = process.argv[2];
const nbLignes = Number(process.argv[3] || 2);
const j = JSON.parse(fs.readFileSync(RACINE + rel, 'utf8'));
console.log('RowStruct :', j[0].Properties && j[0].Properties.RowStruct ? j[0].Properties.RowStruct.ObjectName : '?');
const cles = Object.keys(j[0].Rows);
console.log('lignes :', cles.length, '| premieres cles :', cles.slice(0, 8).join(', '));
for (const k of cles.slice(0, nbLignes)) {
  console.log('=== ligne ' + k + ' ===');
  console.log(JSON.stringify(j[0].Rows[k], null, 1));
}
