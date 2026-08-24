/* Les potentiels d'un coequipier qui atteignent le heros calcule.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe des porteurs
   deja reduits a { charId, typeArme, palier, atk, estLeHeros } ; c'est elle
   qui lit le palier dans le roster et l'ATK par calculateHeroStats.

   Trois filtres, et chacun repond a une question differente :
     l'ARME    quelle branche de potentiels le coequipier a-t-il en main ?
     le PALIER jusqu'ou l'a-t-il monte ? Les paliers sont CUMULATIFS.
     la CIBLE  ce potentiel sort-il de son porteur ? */

import { indexationDe, valeurIndexee } from "./equipe-buffs.js";

  /* Charge A LA DEMANDE par la vue, comme les competences, les buffs et les
     passifs graves : le lire par window plutot que par import evite de le
     faire payer aux visiteurs qui ne calculent rien. */
  function tableDesPotentiels(){
    return window.SEVEN_DS_POTENTIELS_EQUIPE || {};
  }

  /* Le heros recoit les DEUX sortes : un potentiel « allies » dit « tous les
     heros allies », et il en fait partie. Le potentiel « soi » d'un coequipier
     ne le concerne pas. */
  function atteintLeHeros(ligne, porteur){
    return porteur.estLeHeros || ligne.cible === "allies";
  }

  /* Les paliers d'un porteur, du plus bas au plus haut, jusqu'au sien.
     Un palier absent ou illisible ne rend RIEN plutot que tout : un membre qui
     n'a pas renseigne son palier ne doit pas recevoir le palier 10. */
  function paliersOuverts(branche, palier){
    const atteint = Number(palier);
    if(!Number.isFinite(atteint) || atteint < 1) return [];
    return Object.keys(branche)
      .map(Number)
      .filter(niveau => Number.isFinite(niveau) && niveau <= atteint)
      .sort((a, b) => a - b);
  }

  function potentielsEquipeApplicables(entree){
    const source = entree || {};
    const vise = (source.element || "").toLowerCase();
    const porteurs = Array.isArray(source.porteurs) ? source.porteurs : [];
    return porteurs.flatMap(porteur => {
      const branche = (tableDesPotentiels()[porteur.charId] || {})
        [porteur.typeArme];
      if(!branche) return [];
      return paliersOuverts(branche, porteur.palier)
        .flatMap(niveau => (branche[String(niveau)] || [])
          .filter(ligne => atteintLeHeros(ligne, porteur))
          .filter(ligne => !ligne.element
            || ligne.element.toLowerCase() === vise)
          .map(ligne => {
            /* Une ligne indexee sur l'ATK du lanceur retombe sur son PLAFOND
               quand cette ATK est illisible - build incomplet, personnage
               retire du roster. Le plafond, pas zero : la ligne resterait
               sinon cochable sans rien faire, ce qui se lit « ce potentiel ne
               sert a rien ». `repli` le dit a l'ecran. */
            const chiffree = valeurIndexee(ligne, porteur);
            return Object.assign({}, ligne, {
              support:porteur.charId,
              arme:porteur.typeArme,
              palier:niveau,
              valeur:chiffree === null ? ligne.valeur : chiffree,
              repli:Boolean(indexationDe(ligne)) && chiffree === null
            });
          }));
    });
  }

export { potentielsEquipeApplicables };
