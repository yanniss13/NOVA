/* Les bonus temporaires des ensembles sont des scenarios, pas des termes fixes.
   Le palier le plus haut remplace le precedent afin que sept pieces ne double
   jamais les effets de Souverain cupide. */

function passifEnsembleApplicable({ ensembles, etats, setId } = {}){
  const table = (window.SEVEN_DS_PASSIFS_ENSEMBLES || {})[setId];
  const actif = (ensembles || []).find(item => item && item.setId === setId);
  if(!table || !actif) return null;
  const paliers = table.paliers.filter(palier => actif.count >= palier.seuil);
  const palier = paliers[paliers.length - 1];
  if(!palier) return null;
  const valeur = Number((etats || {})[setId]);
  const etat = valeur >= 0 && valeur <= 2 ? valeur : 0;
  return {
    setId,
    nom:table.nom,
    seuil:palier.seuil,
    tier:palier.tier,
    etat,
    lignes:(palier.etats[etat] || []).map(ligne => Object.assign({}, ligne))
  };
}

export { passifEnsembleApplicable };
