/* Les passifs de tenue gravee qui atteignent le heros calcule.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe des porteurs
   deja reduits a { charId, tenue, niveau, estLeHeros } ; c'est elle qui lit
   l'armure liee de chaque build et le niveau de son passif.

   `niveau` vaut 1, 2, 3 ou null. Null n'est pas une erreur : le membre peut ne
   pas avoir renseigne ce champ, et le calcul doit rester possible. */

  /* Le catalogue est charge A LA DEMANDE par la vue, comme les competences et
     les buffs : le lire par window plutot que par import evite de le faire
     payer aux visiteurs qui ne calculent rien. */
  function tableDesPassifs(){
    return window.SEVEN_DS_PASSIFS_GRAVES || {};
  }

  /* Qui recoit quoi.

     Le heros recoit les DEUX sortes : un passif « allies » dit « tous les
     heros allies », et il en fait partie. Le passif « soi » d'un coequipier ne
     le concerne pas. */
  function atteintLeHeros(passif, porteur){
    return porteur.estLeHeros || passif.cible === "allies";
  }

  function passifsGravesApplicables(entree){
    const source = entree || {};
    const vise = (source.element || "").toLowerCase();
    const porteurs = Array.isArray(source.porteurs) ? source.porteurs : [];
    return porteurs.flatMap(porteur => (tableDesPassifs()[porteur.tenue] || [])
      .filter(passif => atteintLeHeros(passif, porteur))
      .filter(passif => !passif.element
        || passif.element.toLowerCase() === vise)
      .map(passif => {
        /* Niveau inconnu : la valeur PLANCHER. Pas le plafond : le chiffre ne
           peut alors qu'etre sous-estime, jamais flatte, et la vue le dit pour
           que le membre sache quoi renseigner. */
        const niveauInconnu = !(porteur.niveau >= 1 && porteur.niveau <= 3);
        const rang = niveauInconnu ? 0 : porteur.niveau - 1;
        /* Le PAS du niveau atteint, pour les passifs qui montent par cumuls.
           `valeur` reste le plafond : elle est ce qu'applique la ligne quand
           le membre declare le combo plein, et le reste de la chaine - le
           moteur, le compte de cases cochees - n'a pas a savoir qu'un grain
           existe. La vue seule multiplie le pas par les cumuls choisis. */
        const parCumul = Array.isArray(passif.parCumul)
          ? passif.parCumul[rang] : null;
        return Object.assign({}, passif, {
          support:porteur.charId,
          tenue:porteur.tenue,
          valeur:passif.niveaux[rang],
          parCumul,
          niveauInconnu
        });
      }));
  }

export { passifsGravesApplicables };
