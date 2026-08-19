"use strict";

/* La cible tactile minimale, et pourquoi ce n'est pas 44 tout rond.

   Le CSS pose `min-height:44px`. Le navigateur cale donc l'element pile a
   la valeur seuil, et `getBoundingClientRect()` rend un flottant qui vaut
   parfois 43.99999999999999 plutot que 44. Un `>= 44` echoue alors sur un
   element rigoureusement conforme, de facon intermittente et dependante de
   la plateforme : vert sur Windows, rouge sur le runner Linux.

   Le seuil ci-dessous absorbe cette erreur d'arithmetique, et rien d'autre.
   Un centieme de pixel ne peut masquer aucune regression reelle : une cible
   veritablement trop petite mesure 32 ou 40 px, jamais 43.99. */
const CIBLE_TACTILE_PX = 43.99;

module.exports = { CIBLE_TACTILE_PX };
