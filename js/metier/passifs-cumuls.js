/* Les passifs a cumuls du heros CALCULE.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe le personnage et
   son arme, rien d'autre.

   Aucun ne vient d'un coequipier, et c'est la difference avec les trois autres
   tables de buffs : « chaque coup PORTE PAR LE HEROS lui octroie un cumul » ne
   profite qu'a celui qui frappe. Il n'y a donc ni porteurs a parcourir ni
   cible a filtrer - une arme suffit a decider.

   Pas de palier non plus : ces passifs appartiennent au kit de base de l'arme,
   pas a une branche de potentiel. Un membre au palier 1 les a deja. */

  /* Charge A LA DEMANDE par la vue, comme les quatre autres catalogues : le
     lire par window plutot que par import evite de le faire payer aux
     visiteurs qui ne calculent rien. */
  function tableDesPassifsCumuls(){
    return window.SEVEN_DS_PASSIFS_CUMULS || {};
  }

  function passifsCumulsApplicables(entree){
    const source = entree || {};
    if(!source.charId || !source.typeArme) return [];
    const branche = (tableDesPassifsCumuls()[source.charId] || {})
      [source.typeArme];
    return Array.isArray(branche) ? branche.slice() : [];
  }

export { passifsCumulsApplicables };
