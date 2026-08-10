/* Souverain cupide est la seule tenue d'ensemble dont les releves sont
   couvertes. Les valeurs restent hors des fichiers generes et sont ancrees
   dans le texte publie par tests/passifs-ensembles.test.js. */

window.SEVEN_DS_PASSIFS_ENSEMBLES = {
  equip_t5_greed:{
    nom:"Souverain cupide",
    paliers:[
      {
        seuil:5,
        tier:"four",
        etats:[
          [],
          [{
            stat:"C_Critical_Rate",
            valeur:300,
            porteur:"hero",
            provenance:{
              phrase:"L'utilisation de la compétence de relève augmente les chances crit. de "
            }
          }],
          [
            {
              stat:"C_Critical_Rate",
              valeur:700,
              porteur:"hero",
              provenance:{
                phrase:"L'utilisation de la compétence de relève alors que cet effet est actif le remplace par un effet qui augmente les chances crit. de "
              }
            },
            {
              stat:"D_Protect_Cur_Rate",
              valeur:700,
              porteur:"hero",
              provenance:{ phrase:"et le percement de défense de " }
            }
          ]
        ]
      },
      {
        seuil:7,
        tier:"seven",
        etats:[
          [],
          [{
            stat:"C_Critical_Rate",
            valeur:600,
            porteur:"hero",
            provenance:{
              phrase:"L'utilisation de la compétence de relève augmente les chances crit. de "
            }
          }],
          [
            {
              stat:"C_Critical_Rate",
              valeur:1200,
              porteur:"hero",
              provenance:{
                phrase:"L'utilisation de la compétence de relève alors que cet effet est actif le remplace par un effet qui augmente les chances crit. de "
              }
            },
            {
              stat:"D_Protect_Cur_Rate",
              valeur:1200,
              porteur:"hero",
              provenance:{ phrase:"et le percement de défense de " }
            }
          ]
        ]
      }
    ]
  }
};
