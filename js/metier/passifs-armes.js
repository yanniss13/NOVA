/* Les passifs de l'arme equipee qui atteignent le heros calcule.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe le fichier de
   l'arme et le niveau deja derive de weaponConfig.overlimit + 1.

   Un niveau absent replie sur le premier : le resultat reste un plancher,
   jamais le plafond flatteur d'un passif dont le membre n'a rien renseigne. */

  function tableDesPassifsArmes(){
    return window.SEVEN_DS_PASSIFS_ARMES || {};
  }

  function passifsArmesApplicables(entree){
    const source = entree || {};
    const fichier = source.fichier;
    const passifs = Array.isArray(tableDesPassifsArmes()[fichier])
      ? tableDesPassifsArmes()[fichier] : [];
    const niveauInconnu = !(source.niveau >= 1 && source.niveau <= 7);
    const rang = niveauInconnu ? 0 : source.niveau - 1;
    return passifs.map(passif => Object.assign({}, passif, {
      arme:fichier,
      valeur:passif.niveaux[rang],
      parCumul:passif.parCumul[rang],
      niveauInconnu
    }));
  }

export { passifsArmesApplicables };
