/* Ecrit data/jauges-releve.js a partir de la table du jeu.

   CE QUE CHAQUE COMPETENCE APPORTE A LA JAUGE DE RELEVE.

   `Skill/PC_SkillTable.json` porte trois champs de jauge par competence :
   `UI_TagGauge`, `UseSkill_TagGauge` et `HitSkill_TagGauge`. C'est le
   PREMIER qu'on retient : c'est le total que le jeu affiche lui-meme pour la
   competence. Les deux autres disent seulement comment il est LIVRE — d'un
   coup a l'activation pour un E ou un Q, coup par coup pour une attaque
   normale. Les trois concordent : `ban_cudgel3c_skill_e` vaut 151 en UI comme
   en UseSkill ; `ban_cudgel3c_normalatk_3` vaut 24 en UI et 8 par coup, soit
   trois coups.

   LE PIEGE DE L ATTAQUE NORMALE. Le catalogue du wiki publie la chaine d autos
   sous un seul identifiant, et cet identifiant est `<heros>_<arme>_jumpatk` —
   qui, DANS LA TABLE DU JEU, designe l attaque sautee, une autre competence,
   a zero de jauge. Joindre naivement sur le gameId donnerait donc zero a la
   chaine d autos. Les vraies valeurs sont dans `<heros>_<arme>_normalatk_1..N`
   et il faut les SOMMER : le site modelise une attaque normale comme un cycle
   complet, pas comme une frappe isolee.

   Ce que ce fichier ne dit pas : le cout d une releve (1000, constante
   `tagpoint_gauge`), le nombre de points cumulables (3, `tagpoint_maxstack`)
   ni la regeneration passive (70 toutes les 1500 ms). Ces constantes vivent
   dans le code qui s en sert, pas dans un catalogue de valeurs.

   Lancer : node outils/fmodel/ecrire-jauges-releve.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const racine = path.join(__dirname, '..', '..');

const source = JSON.parse(fs.readFileSync(T + 'Skill/PC_SkillTable.json', 'utf8'));
const lignes = (source[0] && source[0].Rows) || source.Rows || source;

/* Le catalogue du wiki decide de la LISTE : une rotation ne peut contenir que
   ce qu il publie. Extraire les 2268 lignes de la table remplirait le fichier
   de competences que personne ne peut poser. */
const bac = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, 'data', 'wiki-competences.js'), 'utf8'),
  bac
);
const wiki = bac.window.SEVEN_DS_WIKI_COMPETENCES;

const jaugeDe = id => {
  const ligne = lignes[id];
  return ligne ? Number(ligne.UI_TagGauge) || 0 : null;
};

/* La chaine d autos : toutes les frappes `normalatk_*` du meme porteur. */
const chaineDAutos = prefixe => Object.keys(lignes)
  .filter(id => id.startsWith(prefixe + '_normalatk_'))
  .sort();

const jauges = {};
const absents = [];
let autos = 0;

Object.entries(wiki).forEach(([heros, liste]) => liste.forEach(competence => {
  const id = competence.gameId;
  if (competence.categorie === 'PASSIVE') return;

  if (competence.categorie === 'NORMAL') {
    /* LE PORTEUR SE CHERCHE, IL NE SE DEVINE PAS.

       On voudrait « heros + arme = les deux premiers segments », et ca casse :
       `gil_thunder_lance_jumpatk` a un heros en deux segments. On voudrait
       « tout sauf le dernier segment », et ca casse aussi : cinq heros
       publient leur attaque normale sous une variante enchantee
       (`bug_book_normalatk_1_enchant`), dont toutes les lignes valent zero.

       On rogne donc l identifiant par la fin jusqu a ce qu une chaine
       `_normalatk_*` existe reellement dans la table. C est la table qui
       tranche, pas une regle de decoupage. */
    const segments = id.split('_');
    let prefixe = null;
    let frappes = [];
    for (let garde = segments.length - 1; garde >= 2 && !frappes.length; garde--) {
      prefixe = segments.slice(0, garde).join('_');
      frappes = chaineDAutos(prefixe);
    }
    if (!frappes.length) { absents.push(id + ' (chaine introuvable)'); return; }
    jauges[id] = frappes.reduce((total, frappe) => total + jaugeDe(frappe), 0);
    autos++;
    return;
  }

  const valeur = jaugeDe(id);
  if (valeur === null) { absents.push(id + ' (absent de PC_SkillTable)'); return; }
  jauges[id] = valeur;
}));

/* Tri stable : le fichier est commite. */
const ordonne = {};
Object.keys(jauges).sort().forEach(id => { ordonne[id] = jauges[id]; });

const entete = [
  '// Genere par outils/fmodel/ecrire-jauges-releve.js depuis la table',
  '// Skill/PC_SkillTable.json du jeu (champ UI_TagGauge).',
  '// Ce que chaque competence apporte a la jauge de releve, en points bruts.',
  '// Une releve en coute 1000 (constante tagpoint_gauge), on en cumule 3',
  '// (tagpoint_maxstack).',
  '// L attaque NORMALE porte la somme de sa chaine `normalatk_*` : le wiki la',
  '// publie sous l identifiant du saut, qui vaut zero dans la table.',
  '',
].join('\n');

fs.writeFileSync(
  path.join(racine, 'data', 'jauges-releve.js'),
  entete + 'window.SEVEN_DS_JAUGES_RELEVE = '
    + JSON.stringify(ordonne, null, 1) + ';\n'
);

const valeurs = Object.values(ordonne);
console.log('competences ecrites :', valeurs.length, '| dont chaines d autos :', autos);
console.log('  a zero :', valeurs.filter(v => v === 0).length,
  '| min non nul :', Math.min(...valeurs.filter(v => v > 0)),
  '| max :', Math.max(...valeurs));
console.log('  absents :', absents.length, absents.slice(0, 5).join(', '));
console.log('  Ban gantelets :', ['ban_gauntlets_jumpatk', 'ban_gauntlets_skill_q',
  'ban_gauntlets_skill_e', 'ban_gauntlets_skill_r', 'ban_gauntlets_skill_tag']
  .map(id => id.replace('ban_gauntlets_', '') + '=' + ordonne[id]).join(' '));
