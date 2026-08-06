/* Les objets du wiki : armes, armures, bijoux, armures gravees.

   Rien n'est aspire ici, contrairement au catalogue des competences du lot 1.
   Les IMAGES et les NOMS viennent de data/data.js, les CHIFFRES et les TEXTES
   de data/stats-build.js — et les deux se joignent par le chemin de l'image,
   qui est justement la cle des trois tables de statistiques.

   Une piece dont l'image existe mais dont les statistiques manquent RESTE
   listee, ses champs chiffres a null. Une image ajoutee au depot avant la
   regeneration des statistiques doit apparaitre dans la grille, pas
   disparaitre : un trou silencieux est le pire des etats. */

import {
  BUILD_STATS, DATA, FOLDER_TO_ENUM, LINKED_ARMOR_SLOT
} from "../noyau/constantes.js";

  /* Le repli de constantes.js ne porte que `weaponsByFile` : les trois autres
     tables peuvent manquer sans que le site cesse d'etre affichable. */
  const catalogueArmes = () => BUILD_STATS.weaponsByFile || {};
  const cataloguePieces = () => BUILD_STATS.gearByFile || {};
  const catalogueGravees = () => BUILD_STATS.engravedByFile || {};
  const catalogueEnsembles = () => BUILD_STATS.gearSets || {};

  const parNom = (a, b) => a.nom.localeCompare(b.nom, "fr-FR");

  /* L'ordre des raretes est celui du jeu, lu sur le chiffre du suffixe : un
     tri alphabetique rangerait grade10 avant grade2. */
  function rangDeRarete(rarete){
    const chiffre = /(\d+)$/.exec(String(rarete || ""));
    return chiffre ? Number(chiffre[1]) : 0;
  }

  function raretesDe(stats){
    const vues = new Set();
    Object.values((stats && stats.gradesByGameId) || {}).forEach(grade => {
      if(grade && grade.rarity) vues.add(grade.rarity);
    });
    return [...vues].sort((a, b) => rangDeRarete(a) - rangDeRarete(b));
  }

  function armesDuWiki(){
    const liste = [];
    Object.values(DATA.armes || {}).forEach(famille => {
      (famille || []).forEach(arme => {
        const stats = catalogueArmes()[arme.file];
        const raretes = raretesDe(stats);
        liste.push({
          nature:"arme",
          file:arme.file,
          nom:arme.name,
          /* Le type vient des statistiques quand elles existent, du DOSSIER de
             l'image sinon. ⚠️ Le dossier (« Bouclier ») n'est pas la cle de
             DATA.armes (« Epee & bouclier »), qui est un libelle d'affichage.
             C'est le dossier qui porte la correspondance, comme dans
             metier/armes.js. */
          type:(stats && stats.weaponType)
            || FOLDER_TO_ENUM[String(arme.file).split("/")[1]] || null,
          raretes,
          rareteMax:raretes.length ? raretes[raretes.length - 1] : null,
          aPassif:!!(stats && stats.passiveLevels && stats.passiveLevels.length)
        });
      });
    });
    return liste.sort(parNom);
  }

  function piecesDe(source, nature){
    const liste = [];
    Object.entries(source || {}).forEach(([famille, items]) => {
      (items || []).forEach(item => {
        const stats = cataloguePieces()[item.file];
        liste.push({
          nature,
          file:item.file,
          nom:item.name,
          /* La FAMILLE de data.js — « Haut », « Anneau » — et non le `slot`
             anglais des statistiques : c'est le vocabulaire du site, et il
             reste connu quand les statistiques manquent. */
          famille,
          setId:(stats && stats.setId) || null,
          grade:(stats && stats.grade) || null
        });
      });
    });
    return liste.sort(parNom);
  }

  /* Les armures gravees vivent dans DATA.armures sous la meme cle que partout
     ailleurs dans l'appli — « Armure liee ». Elles ont ici leur propre
     categorie : elles n'appartiennent a aucun ensemble et sont liees a un
     heros. Les retirer des armures n'est donc pas un filtrage cosmetique. */
  function sansGravees(source){
    const reste = Object.assign({}, source || {});
    delete reste[LINKED_ARMOR_SLOT];
    return reste;
  }

  const armuresDuWiki = () => piecesDe(sansGravees(DATA.armures), "armure");
  const bijouxDuWiki = () => piecesDe(DATA.bijoux, "bijou");

  function graveesDuWiki(){
    return ((DATA.armures || {})[LINKED_ARMOR_SLOT] || []).map(item => {
      const stats = catalogueGravees()[item.file];
      return {
        nature:"gravee",
        file:item.file,
        nom:item.name,
        heros:(stats && stats.character) || null
      };
    }).sort(parNom);
  }

  const PALIERS = [
    ["twoCount", "twoStats", "twoTextFr"],
    ["fourCount", "fourStats", "fourTextFr"],
    ["sevenCount", "sevenStats", "sevenTextFr"]
  ];

  /* Un ensemble et TOUTES ses pieces, armures et bijoux confondus.

     C'est ce qui repare la coupure des deux grilles : « Au bord du neant » n'a
     que des bijoux, « Rugissement sauvage » que des armures, et un membre
     arrive sur la fiche par l'une ou par l'autre. La liste des pieces ne
     depend donc pas de la grille d'ou l'on vient. */
  function ensembleDe(setId){
    const brut = catalogueEnsembles()[setId];
    if(!brut) return null;
    const paliers = [];
    PALIERS.forEach(([compte, stats, texte]) => {
      /* ⚠️ Les seuils ne sont pas 2 / 4 / 7 : ils se lisent dans les donnees.
         Et un seuil absent n'est pas un seuil a zero — l'ensemble n'a tout
         simplement pas ce palier. */
      if(brut[compte] === null || brut[compte] === undefined) return;
      paliers.push({
        compte:brut[compte],
        stats:brut[stats] || [],
        texte:brut[texte] || ""
      });
    });
    return {
      id:setId,
      nom:brut.nameFr || setId,
      paliers,
      pieces:armuresDuWiki().concat(bijouxDuWiki())
        .filter(piece => piece.setId === setId)
        .sort(parNom)
    };
  }

  /* Ou vit cet objet : son entree, et la liste de sa categorie.

     La liste vient avec, pour que la modale garde son « precedent / suivant »
     quand on y arrive par une piece soeur plutot que par la grille. */
  function objetDuWiki(file){
    const listes = [
      armesDuWiki(), armuresDuWiki(), bijouxDuWiki(), graveesDuWiki()
    ];
    for(const liste of listes){
      const entree = liste.find(item => item.file === file);
      if(entree) return { entree, liste };
    }
    return null;
  }

export {
  armesDuWiki,
  armuresDuWiki,
  bijouxDuWiki,
  ensembleDe,
  graveesDuWiki,
  objetDuWiki
};
