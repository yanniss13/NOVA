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

   POURQUOI LE FICHIER PORTE SA PROVENANCE

   Le depot ne contient pas l'export, et `data/` ne se modifie jamais a la
   main : hors ligne, rien ne distingue « le jeu ne publie aucune combinaison
   pour ce heros » de « le generateur n'a jamais tourne sur un build qui le
   contient ». Le releve ecrit ci-dessous dit ce que la table contenait — son
   compte de lignes et les competences qu'elle nomme — et les tests s'y
   adossent. Un plancher ecrit a la main dans un test aurait perime au premier
   build ; celui-la se regenere avec les donnees.

   Lancer : node outils/fabrication/ecrire-ultimes-combines.js
*/
const fs = require('fs');
const path = require('path');

const T = (process.env.DONNEES_JEU || '') + '/Table/';
const racine = path.join(__dirname, '..', '..');

const fichierSource = T + 'Skill/CombineSkillTable.json';
const source = JSON.parse(fs.readFileSync(fichierSource, 'utf8'));
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

/* Le recensement de la table, lu sur les lignes BRUTES : toutes les
   competences que `CombineSkillTable` nomme, lanceurs et partenaires
   confondus. C'est lui qui rend verifiable, hors ligne, l'absence d un heros
   de la table. */
const competencesRecensees = new Set();
Object.values(lignes).forEach(ligne => {
  [ligne.Owner_Skill_Tid, ligne.Striker_A_Skill_Tid, ligne.Striker_B_Skill_Tid]
    .forEach(tid => {
      if (tid && tid !== 'None') competencesRecensees.add(tid);
    });
});

const provenance = {
  source: 'Table/Skill/CombineSkillTable',
  /* La date du fichier source au moment de l extraction : l export ne publie
     aucun numero de build lisible par une machine, c est le seul horodatage
     que le generateur peut relever sans qu on le lui dicte. */
  exporteLe: fs.statSync(fichierSource).mtime.toISOString().slice(0, 10),
  lignesLues: Object.keys(lignes).length,
  lignesRetenues: combinaisons.length,
  lanceurs: new Set(combinaisons.map(c => c.lanceur)).size,
  competences: [...competencesRecensees].sort(),
  regenerer: 'node outils/fabrication/ecrire-ultimes-combines.js',
};

const entete = [
  '// Genere par outils/fabrication/ecrire-ultimes-combines.js depuis les',
  '// donnees du jeu.',
  '// lanceur = Owner_Skill_Tid, le heros qui declenche. partenaires =',
  '// Striker_A puis Striker_B, un ou deux selon la combinaison.',
  '// Les identifiants portent l ARME : une combinaison n est possible que si',
  '// chaque participant porte l arme citee.',
  '// PROVENANCE : ce que la table contenait a l extraction. Le depot n a pas',
  '// l export ; sans ce releve, un catalogue tronque ou une table sans un',
  '// heros seraient indiscernables d une extraction jamais relancee.',
  '',
].join('\n');

fs.writeFileSync(
  path.join(racine, 'data', 'ultimes-combines.js'),
  entete
    + 'window.SEVEN_DS_ULTIMES_COMBINES_PROVENANCE = '
    + JSON.stringify(provenance, null, 1) + ';\n\n'
    + 'window.SEVEN_DS_ULTIMES_COMBINES = '
    + JSON.stringify(combinaisons, null, 1) + ';\n'
);

const ultimes = combinaisons.filter(c => /_skill_r$/.test(c.lanceur));
console.log('combinaisons ecrites :', combinaisons.length);
console.log('  dont lanceur a l ultime :', ultimes.length);
console.log('  dont trois heros :', combinaisons.filter(c => c.partenaires.length === 2).length);
