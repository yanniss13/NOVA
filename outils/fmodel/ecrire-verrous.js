/* Ecrit data/animations-verrous.json a partir de data/temps-action.json.

   Le verrou est le premier instant ou le heros peut relancer une action
   OFFENSIVE : la plus precoce des fenetres `activeSkill` et `normalAttack`.
   Les fenetres `avoidance`, `jump` et `movement` sont volontairement exclues —
   pouvoir esquiver n'est pas pouvoir attaquer, et les compter ramenerait tous
   les verrous a zero.

   Une action sans fenetre connue n'entre PAS dans le fichier : le simulateur
   compte alors zero, comme aujourd'hui. Mieux vaut une absence qu'une duree
   supposee.

   Lancer : node outils/fmodel/ecrire-verrous.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const racine = path.join(__dirname, '..', '..');
const actions = JSON.parse(
  fs.readFileSync(path.join(racine, 'data', 'temps-action.json'), 'utf8')
).actions;

const bac = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, 'data', 'competences.js'), 'utf8'),
  bac
);
const catalogue = bac.window.SEVEN_DS_COMPETENCES;

const OFFENSIVES = ['activeSkill', 'normalAttack'];
function verrouDe(action) {
  let min = null;
  for (const type of OFFENSIVES) {
    const f = action.fenetres && action.fenetres[type];
    if (f && Number.isFinite(f.debut) && (min === null || f.debut < min)) min = f.debut;
  }
  if (min === null) return null;
  // Jamais plus que la duree totale : une fenetre qui s'ouvrirait apres la fin
  // signalerait une donnee incoherente, pas un verrou plus long.
  if (Number.isFinite(action.duree) && min > action.duree) return null;
  return Math.round(min * 1000) / 1000;
}

const verrous = {};
let sansFenetre = 0, sansAction = 0, nul = 0, saut = 0;
const parCategorie = {};
for (const liste of Object.values(catalogue)) {
  for (const competence of liste || []) {
    const id = competence && competence.gameId;
    if (!id) continue;
    const action = actions[String(id).toLowerCase()];
    if (!action) { sansAction++; continue; }
    /* Les attaques sautees sont ecartees. Leur fenetre s'ouvre a zero chez
       presque tout le monde — le jeu ne les bride pas par l'animation mais par
       le saut lui-meme, qu'aucun simulateur ici ne modelise. Publier un verrou
       pour la seule qui en porte un (diane/Cudgel3c) la rendrait repetable
       toutes les 0,7 s et la ferait bondir du 51e au 3e rang du classement,
       sur une hypothese invérifiable. */
    if (/jumpatk/i.test(id)) { saut++; continue; }

    const v = verrouDe(action);
    if (v === null) { sansFenetre++; continue; }
    /* Le zero est PUBLIE, pas omis. Pour le simulateur c'est identique —
       il exige `secondes > 0` pour retenir une valeur, donc un 0 explicite
       et une clef absente donnent le meme resultat. Mais le fichier dit
       alors la difference entre « je sais que c'est zero » et « je ne sais
       pas », et la liste de chronometrage cesse d'envoyer mesurer 202
       competences dont la reponse est connue. */
    if (v <= 0) nul++;
    verrous[id] = v;
    if (v <= 0) continue;   // pas de moyenne sur un verrou nul
    const c = competence.categorie || '?';
    const p = parCategorie[c] || (parCategorie[c] = { n: 0, somme: 0 });
    p.n++; p.somme += v;
  }
}

const sortie = {
  _lisezmoi: [
    "Verrous d'animation DEDUITS des fichiers du jeu (build 1.8.1.2), pas",
    'mesures en jeu. A ne pas confondre avec data/animations-mesurees.json,',
    "qui est ecrit a la main et fait FOI la ou il parle.",
    '',
    "Valeur : le premier instant, en secondes, ou le heros peut relancer une",
    "action offensive apres celle-ci. Lu dans les marqueurs EEnableSkipBy* du",
    'montage, en ne retenant que les fenetres activeSkill et normalAttack.',
    '',
    'Un verrou NUL est publie tel quel : le heros peut relancer aussitot,',
    "et c'est une reponse, pas une lacune.",
    '',
    "Une action dont aucune fenetre n'est connue est ABSENTE de ce fichier,",
    'ainsi que les attaques sautees, bridees par le saut et non par',
    "l'animation. Le simulateur compte zero dans les deux cas — mais",
    "l'absence signale desormais une vraie inconnue, a chronometrer.",
    '',
    'Regenerer : node outils/fmodel/ecrire-verrous.js',
  ],
  _unite: 'secondes',
  _build: '1.8.1.2',
  animations: verrous,
};

const cible = path.join(racine, 'data', 'animations-verrous.json');
fs.writeFileSync(cible, JSON.stringify(sortie, null, 1) + '\n');

console.log('verrous ecrits :', Object.keys(verrous).length);
console.log('  dont verrou nul :', nul, '| attaques sautees ecartees :', saut);
console.log('  sans fenetre connue :', sansFenetre, '| sans action dans la table :', sansAction);
console.log('moyenne par categorie :');
for (const [c, p] of Object.entries(parCategorie).sort((a, b) => b[1].somme / b[1].n - a[1].somme / a[1].n)) {
  console.log('  ' + c.padEnd(16) + String(p.n).padStart(4) + '  ' + (p.somme / p.n).toFixed(3) + ' s');
}
