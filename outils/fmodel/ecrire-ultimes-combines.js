/* Ecrit data/ultimes-combines.js a partir de la table du jeu.

   `Skill/CombineSkillTable.json` publie 672 lignes. Le champ
   `Owner_Skill_Tid` EST le lanceur — on ne le deduit pas, la table le dit.
   `Striker_A_Skill_Tid` et `Striker_B_Skill_Tid` portent les partenaires ; le
   second vaut `None` sur les combinaisons a deux heros.

   L'appariement se fait par COMPETENCE, donc par arme : les 21 combinaisons de
   Ban sont toutes `ban_gauntlets_skill_r`. Un Ban au nunchaku n'en lance
   aucune, et c'est la table qui l'interdit, pas une liste ecrite a la main.

   `String_Tid` et `Local_Key` valent `None` : aucune combinaison n'a de nom
   publie. Le catalogue n'en invente pas — la case se nomme par ses
   participants.

   Lancer : node outils/fmodel/ecrire-ultimes-combines.js
*/
const fs = require('fs');
const path = require('path');

const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const racine = path.join(__dirname, '..', '..');

const source = JSON.parse(fs.readFileSync(T + 'Skill/CombineSkillTable.json', 'utf8'));
const lignes = (source[0] && source[0].Rows) || source.Rows || source;

const combinaisons = Object.values(lignes)
  .map(ligne => ({
    lanceur: ligne.Owner_Skill_Tid,
    partenaires: [ligne.Striker_A_Skill_Tid, ligne.Striker_B_Skill_Tid]
      .filter(tid => tid && tid !== 'None'),
  }))
  .filter(c => c.lanceur && c.lanceur !== 'None' && c.partenaires.length);

/* Tri stable : le fichier est commite, deux extractions successives ne doivent
   pas produire un diff qui ne dit rien. */
const cle = c => c.lanceur + '|' + c.partenaires.join('|');
combinaisons.sort((a, b) => cle(a).localeCompare(cle(b)));

const entete = [
  '// Genere par outils/fmodel/ecrire-ultimes-combines.js depuis la table',
  '// Skill/CombineSkillTable.json du jeu.',
  '// lanceur = Owner_Skill_Tid, le heros qui declenche. partenaires =',
  '// Striker_A puis Striker_B, un ou deux selon la combinaison.',
  '// Les identifiants portent l ARME : une combinaison n est possible que si',
  '// chaque participant porte l arme citee.',
  '',
].join('\n');

fs.writeFileSync(
  path.join(racine, 'data', 'ultimes-combines.js'),
  entete + 'window.SEVEN_DS_ULTIMES_COMBINES = '
    + JSON.stringify(combinaisons, null, 1) + ';\n'
);

const ultimes = combinaisons.filter(c => /_skill_r$/.test(c.lanceur));
console.log('combinaisons ecrites :', combinaisons.length);
console.log('  dont lanceur a l ultime :', ultimes.length);
console.log('  dont trois heros :', combinaisons.filter(c => c.partenaires.length === 2).length);
