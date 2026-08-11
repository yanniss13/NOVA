/* Les passifs de l'arme equipee qui atteignent le heros calcule.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe le fichier de
   l'arme et le niveau deja derive de weaponConfig.overlimit + 1.

   Un niveau absent replie sur le premier : le resultat reste un plancher,
   jamais le plafond flatteur d'un passif dont le membre n'a rien renseigne.

   La table range les passifs par FAMILLE d'armes, parce que douze armes - une
   par type - partagent souvent le meme passif. Ce module rend ce decoupage
   invisible en aval : l'appelant nomme un fichier, il recoit des lignes. */

  const NIVEAUX = 7;

  function tableDesPassifsArmes(){
    const table = window.SEVEN_DS_PASSIFS_ARMES;
    return Array.isArray(table) ? table : [];
  }

  /* La valeur d'un champ au niveau demande. Un champ SCALAIRE vaut pour les
     sept niveaux - `cumuls` est le plus souvent constant - tandis qu'un
     tableau donne sa valeur rang par rang. Confondre les deux ferait rendre
     le tableau entier la ou un nombre est attendu. */
  function auRang(valeur, rang){
    if(Array.isArray(valeur)) return valeur[rang];
    return valeur === undefined ? null : valeur;
  }

  function passifsArmesApplicables(entree){
    const source = entree || {};
    const fichier = source.fichier;
    const niveauInconnu = !(source.niveau >= 1 && source.niveau <= NIVEAUX);
    const rang = niveauInconnu ? 0 : source.niveau - 1;
    return tableDesPassifsArmes()
      .filter(famille => Array.isArray(famille.armes)
        && famille.armes.indexOf(fichier) !== -1)
      .reduce((lignes, famille) => lignes.concat(
        Array.isArray(famille.lignes) ? famille.lignes : []
      ), [])
      .map(ligne => Object.assign({}, ligne, {
        arme:fichier,
        valeur:ligne.niveaux[rang],
        /* `parCumul` et `cumuls` restent absents des passifs qui ne montent
           pas par crans. Rendre zero les ferait passer pour reglables a la
           vue, qui deroulerait un selecteur vide. */
        parCumul:auRang(ligne.parCumul, rang),
        cumuls:auRang(ligne.cumuls, rang),
        niveauInconnu
      }));
  }

  /* OU VA CE PASSIF, decide ici plutot que dans la vue.

     Un taux sur toute l'attaque elementaire doit rejoindre les BASES, avant
     qu'elles ne resolvent la somme elementaire : verse plus tard, il
     n'atteindrait qu'un nombre deja calcule et resterait inerte. Tout le reste
     - taux d'attaque, taux critique, vulnerabilite de la cible - fait le
     trajet inverse et passe par les lignes cochees, ou entreesDuCalcul sait
     deja le ranger.

     Cette regle vit dans le module PUR pour qu'un test la verifie sans
     navigateur : se tromper de cote ferait soit disparaitre un passif, soit
     le compter deux fois. */
  function versLAttaqueElementaire(passif){
    return Boolean(passif) && passif.stat === "AllElement_Rate";
  }

export { passifsArmesApplicables, versLAttaqueElementaire };
