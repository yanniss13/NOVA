const fs = require('fs');
const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const rows = JSON.parse(fs.readFileSync(T + 'Misc/DefineTable.json', 'utf8'))[0].Rows;

const estNombre = (r) => String(r.Type) === 'EDefineType::Number';
const brut = (r) => estNombre(r) ? r.NValue : r.SValue;

// 10000 vaut 100 % — mais seulement pour les champs de taux.
const estTaux = (k) => /_rate$|_rate_|per_rate|_res$|_con$/.test(k);
const pourcent = (n) => (n / 100).toFixed(2).replace(/\.?0+$/, '') + ' %';

const GROUPES = [
  ['Plafonds et planchers', /^battle_(max|min)_/, 'Les bornes que le jeu applique en fin de calcul.'],
  ['Critique', /critical/i, null],
  ['Precision, blocage, percement', /accuracy|block|pierce|protect/i, null],
  ['Elements et faiblesse', /weakness|element/i, null],
  ['Correction de degats selon la distance', /damcorrection/i, 'Mecanique de decroissance des degats avec la portee.'],
  ['Defense', /def(_|rate|$)|totaldef/i, null],
  ['JcJ', /^ga_pvp_(dam|finaldam)/i, null],
  ['Poids de puissance de combat', /^battle_p_/, 'Prefixe `battle_p_`. Les suffixes reprennent les codes de statistiques (`a_accuracy` pour `A_Accuracy`, `c_critical_rate` pour `C_Critical_Rate`). Lecture a confirmer contre une puissance affichee en jeu.'],
];

const EXCLURE = /^sound_|flagwar|automatching|friend_list|_fx$|elementdevice/;

let md = `# Constantes de combat lues dans le client\n\n`;
md += `Extraites de \`SevenDeadlySins/Content/Table/Misc/DefineTable\` (934 constantes au\n`;
md += `total), build \`1.8.1.2\`. Valeurs **brutes**, telles que le jeu les stocke.\n\n`;
md += `> **Echelle.** Pour les champs de taux, 10000 vaut 100 %. La colonne « en %% »\n`;
md += `> n'est remplie que pour ceux-la. Partout ailleurs l'unite est inconnue : une\n`;
md += `> portee est en unites Unreal, une duree en millisecondes.\n\n`;
md += `> **Ce que ce fichier n'est pas.** Il donne les constantes de la formule, pas la\n`;
md += `> formule. L'ordre des operations est dans le code C++ du client, et le calcul\n`;
md += `> qui fait autorite tourne cote serveur. Rien de tout cela n'est extractible.\n\n`;

const vus = new Set();
for (const [titre, motif, note] of GROUPES) {
  const lignes = Object.entries(rows)
    .filter(([k]) => !vus.has(k) && motif.test(k) && !EXCLURE.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  if (!lignes.length) continue;
  md += `## ${titre}\n\n`;
  if (note) md += `${note}\n\n`;
  md += `| Constante | Valeur | En % |\n|---|---:|---:|\n`;
  for (const [k, r] of lignes) {
    vus.add(k);
    const v = brut(r);
    const p = estNombre(r) && estTaux(k) ? pourcent(v) : '';
    md += `| \`${k}\` | ${typeof v === 'string' ? '`' + v + '`' : v} | ${p} |\n`;
  }
  md += `\n`;
}
md += `---\n\n${vus.size} constantes de combat retenues sur les 934 de la table.\n`;

fs.writeFileSync('c:/Users/yanni/Desktop/Site Confrérie 7ds/docs/constantes-combat-du-jeu.md', md);
console.log('ecrit :', vus.size, 'constantes');
