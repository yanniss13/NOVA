// Les passifs du heros dont le bonus de degats depend d'un nombre de CUMULS.
//
//   « Combo de coups : augmente les degats de Duel de 10 %. (Max : 50 fois) »
//                                          (derieri, Gantelets, « Amplification de combo »)
//
// MAINTENU A LA MAIN, comme buffs-supports.js, passifs-graves.js,
// potentiels-equipe.js et degats-supplementaires.js. Aucun script ne le
// genere, aucun ne doit le citer, et c'est le test qui le tient.
//
// CE QUI DISTINGUE CETTE TABLE DES QUATRE AUTRES, et il faut le lire avant
// d'y ajouter une ligne : sa valeur ne se TRANSCRIT pas, elle se MESURE.
//
//   Les quatre autres tables citent une phrase du jeu et stockent le nombre
//   qui la suit ; leurs tests le reverifient mot a mot. Ici, le jeu ne publie
//   pas le nombre. L'infobulle de « Combo de coups » ne parle que des degats
//   de Duel - elle est muette sur les degats de competence, que le cumul
//   augmente pourtant. Il a fallu le relever sur le mannequin.
//
//   Consequence : aucun test ne peut confronter ces valeurs a une source. La
//   seule protection est la MESURE elle-meme, rejouee en test de non-regression
//   dans tests/degats-calcul.test.js. Une ligne ajoutee ici sans releve serait
//   invisible et fausse - ne pas en ajouter « par analogie avec » une autre.
//
// LA MESURE. Derieri, Gantelets, palier 5, mannequin d'entrainement (ni
// defense ni resistance), compétence « Assaut fulgurant » (501 %, deux frappes
// a 186 % et 315 %). ATK de base 25 481,49 ; palier 4 du potentiel +45 %.
// La frappe 2 porte toujours UN cumul de plus que la frappe 1, puisque chaque
// coup porte en octroie un.
//
//   frappe 1, 0 cumul               68 724
//   frappe 1, 4 cumuls              70 221     -> +0,54472 % par cumul
//   frappe 2, 1 cumul              117 021     -> +0,54499 % par cumul
//   frappe 2, 5 cumuls, critique   270 747     -> +0,54479 % par cumul
//
// Trois estimations independantes, dispersion 0,05 %. La valeur retenue est
// leur moyenne, 0,5448 % par cumul.
//
// OU LE BONUS ATTERRIT, et c'est un CHOIX, pas une mesure :
//   dans le seau ADDITIF global (`bonusGlobal`), celui que le moteur partage
//   deja avec la vulnerabilite sans categorie et la faiblesse de l'ennemi.
//
//   Ce que ce choix suppose : qu'un bonus de degats sans categorie nommee se
//   comporte comme les autres bonus sans categorie nommee. Les mesures ne
//   peuvent pas le trancher - le bonus de categorie d'equipement de Derieri
//   vaut zero sur cette competence, donc additif et multiplicatif y donnent le
//   MEME chiffre. Les deux ne divergent que sur une competence ou le heros
//   porte aussi un bonus de categorie : son ultime, avec ses 72,91 %, les
//   separe de 10 % a 50 cumuls. C'est la mesure qui trancherait.
//
// CE QUE LA CASE DECLARE. Une seule case, et elle vaut le PLAFOND : cocher,
// c'est declarer le combo plein. Le calculateur ne demande pas au membre son
// nombre de cumuls exact - il change a chaque coup porte, et un chiffre saisi
// serait perime avant d'etre lu. Le total affiche est donc un plafond, comme
// pour toutes les autres cases de la page.
//
// Cle : personnage -> ARME (nom de dossier, « Gantelets »), comme
// potentiels-equipe.js et degats-supplementaires.js. Pas de palier : ces
// passifs appartiennent au kit de base, pas a un potentiel.
//
// parCumul : le bonus d'UN cumul, en dix-milliemes, tel que mesure.
// cumuls   : le plafond publie par le jeu - lui, il est ecrit dans
//            l'infobulle, et le test le compare au texte du catalogue. Meme
//            nom que dans buffs-supports.js et passifs-graves.js : une seule
//            notion, un seul mot.
// valeur   : ce que la case applique, soit parCumul x cumuls. Un maximum qui
//            se calcule ne se pose pas de tete : le test verifie le produit,
//            comme pour les repetitions des degats supplementaires.
//
// PAS DE SELECTEUR ICI, contrairement aux passifs de tenue a paliers. A
// cinquante crans, derouler cinquante et une lignes coute plus que le grain ne
// rapporte, et le combo se remplit vite en combat. La vue ne pose donc son
// marqueur `reglable` que sur les tenues gravees ; le choix est commente la-bas.
window.SEVEN_DS_PASSIFS_CUMULS = {
  "derieri": {
    "Gantelets": [
      {
        id:"derieri-gantelets-combo-de-coups",
        libelle:"Combo de coups au maximum (50 cumuls) : dégâts +27,24 %",
        /* Le passif qui octroie le cumul, cite pour que la ligne soit
           retrouvable dans le catalogue du wiki - et pour que le test verifie
           qu'elle ne decrit pas un passif inexistant. */
        gameId:"derieri_gauntlets_passive",
        effet:"bonusDegatsHeros",
        parCumul:54.48,
        cumuls:50,
        valeur:2724,
        unite:"ten-thousandths",
        element:null
      }
    ]
  }
};
