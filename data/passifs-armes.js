// Passifs d'arme qui changent les degats.
//
// ECRIT ET MAINTENU A LA MAIN. Aucun generateur ne produit cette table : le
// test relit chaque chiffre dans le texte publie de l'arme, niveau par niveau.
//
// UNE ENTREE, PLUSIEURS FICHIERS. Les armes de raid vont par familles de douze
// - une par type d'arme - qui partagent le MEME passif, mot pour mot et niveau
// par niveau. Le catalogue compte 94 armes a passif pour seulement 23 passifs
// distincts. Nommer la famille plutot que le fichier evite donc douze copies a
// tenir d'accord a chaque correction, SANS elargir la portee : `armes` cite
// chaque fichier un par un, et le test relit le texte publie de chacun.
//
// Le TYPE d'arme, lui, resterait trop large : Derieri peut equiper treize
// gantelets, mais seul celui de l'ame vorace porte Barrage des Tenebres.
//
// CE QUI RESTE DEHORS, et pourquoi. Plusieurs passifs gagnent une SECONDE
// PHRASE a partir du niveau 4. Elle est absente des trois premiers niveaux,
// donc l'ancre du test ne peut pas la trouver aux sept niveaux, et surtout sa
// condition de declenchement n'est mesuree nulle part. Aucune valeur ne lui est
// attribuee ici tant qu'un releve en jeu ne l'aura pas confirmee.
window.SEVEN_DS_PASSIFS_ARMES = [
  {
    famille:"Flamme cramoisie",
    armes:[
      "7ds-armes/Baguette/Baguette de la flamme cramoisie.webp",
      "7ds-armes/Baton/Bâton de la flamme cramoisie.webp",
      "7ds-armes/Bouclier/Épée et bouclier de la flamme cramoisie.webp",
      "7ds-armes/Epee 1 main/Épée longue de la flamme cramoisie.webp",
      "7ds-armes/Epee 2 mains/Espadon de la flamme cramoisie.webp",
      "7ds-armes/Epees doubles/Épées doubles de la flamme cramoisie.webp",
      "7ds-armes/Gantelets/Gantelets de la flamme cramoisie.webp",
      "7ds-armes/Hache/Hache de la flamme cramoisie.webp",
      "7ds-armes/Lance/Lance de la flamme cramoisie.webp",
      "7ds-armes/Livre/Grimoire de la flamme cramoisie.webp",
      "7ds-armes/Nunchaku/Nunchaku de la flamme cramoisie.webp",
      "7ds-armes/Rapiere/Rapière de la flamme cramoisie.webp"
    ],
    lignes:[
      {
        id:"flamme-cramoisie-deluge-attaque",
        libelle:"Après un Déluge : attaque +40 % (10 s)",
        stat:"I_AtkAdd_Rate",
        /* Un TAUX sur l'attaque, jamais une valeur plate : `multiply` est ce
           qui distingue « +40 % d'attaque » de « +40 points d'attaque ». */
        operation:"multiply",
        unite:"ten-thousandths",
        niveaux:[2800, 3000, 3200, 3400, 3600, 3800, 4000],
        provenance:{ phrase:"augmente l'attaque de " }
      }
    ]
  },
  {
    famille:"Ailes de la flamme noire",
    armes:[
      "7ds-armes/Baguette/Baguette des ailes de la flamme noire.webp",
      "7ds-armes/Baton/Bâton des ailes de la flamme noire.webp",
      "7ds-armes/Bouclier/Épée et bouclier des ailes de la flamme noire.webp",
      "7ds-armes/Epee 1 main/Épée longue des ailes de la flamme noire.webp",
      "7ds-armes/Epee 2 mains/Espadon des ailes de la flamme noire.webp",
      "7ds-armes/Epees doubles/Épées doubles des ailes de la flamme noire.webp",
      "7ds-armes/Gantelets/Gantelets des ailes de la flamme noire.webp",
      "7ds-armes/Hache/Hache des ailes de la flamme noire.webp",
      "7ds-armes/Lance/Lance des ailes de la flamme noire.webp",
      "7ds-armes/Livre/Grimoire des ailes de la flamme noire.webp",
      "7ds-armes/Nunchaku/Nunchaku des ailes de la flamme noire.webp",
      "7ds-armes/Rapiere/Rapière des ailes de la flamme noire.webp"
    ],
    /* Une seule phrase du jeu, mais DEUX statistiques : elles se cochent
       ensemble en jeu et se cochent donc separement ici, faute de quoi une
       seule case porterait deux valeurs que le moteur range ailleurs. */
    lignes:[
      {
        id:"ailes-flamme-noire-deluge-attaque",
        libelle:"Après un Déluge : attaque +40 % (10 s)",
        stat:"I_AtkAdd_Rate",
        operation:"multiply",
        unite:"ten-thousandths",
        niveaux:[2800, 3000, 3200, 3400, 3600, 3800, 4000],
        provenance:{ phrase:"augmente l'attaque de " }
      },
      {
        id:"ailes-flamme-noire-deluge-critique",
        libelle:"Après un Déluge : chances crit. +15 % (10 s)",
        stat:"C_Critical_Rate",
        /* Le critique de l'ARME est celui du heros, donc il subit le plafond
           de 90 % - a la difference d'un buff de soutien, qui s'ajoute apres.
           `porteur` est ce qui fait la difference dans entreesDuCalcul. */
        porteur:"hero",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[600, 750, 900, 1050, 1200, 1350, 1500],
        provenance:{ phrase:"et les chances crit. de " }
      }
    ]
  },
  {
    famille:"Flamboyante",
    armes:[
      "7ds-armes/Baguette/Baguette flamboyante.webp",
      "7ds-armes/Baton/Bâton flamboyant.webp",
      "7ds-armes/Bouclier/Épée et bouclier flamboyants.webp",
      "7ds-armes/Epee 1 main/Épée longue flamboyante.webp",
      "7ds-armes/Epee 2 mains/Espadon flamboyant.webp",
      "7ds-armes/Epees doubles/Épées doubles flamboyantes.webp",
      "7ds-armes/Gantelets/Gantelets flamboyants.webp",
      "7ds-armes/Hache/Hache flamboyante.webp",
      "7ds-armes/Lance/Lance flamboyante.webp",
      "7ds-armes/Livre/Grimoire flamboyant.webp",
      "7ds-armes/Nunchaku/Nunchaku flamboyant.webp",
      "7ds-armes/Rapiere/Rapière flamboyante.webp"
    ],
    lignes:[
      {
        id:"flamboyante-pv-pleins-vulnerabilite",
        libelle:"Ennemi à PV pleins : dégâts subis +50 % (20 s)",
        /* Une propriete de la CIBLE, pas du heros : elle porte un `effet` et
           aucun code de stat, parce que libelles-stats.json ne decrit que des
           statistiques de heros. Le premier coup d'un combat la remplit
           toujours ; les suivants, presque jamais. */
        effet:"vulnerabiliteGlobale",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[2000, 2500, 3000, 3500, 4000, 4500, 5000],
        provenance:{ phrase:"augmente ses dégâts subis de " }
      }
    ]
  },
  {
    famille:"Noir de jais",
    armes:[
      "7ds-armes/Baguette/Baguette noir de jais.webp",
      "7ds-armes/Baton/Bâton noir de jais.webp",
      "7ds-armes/Bouclier/Épée et bouclier noir de jais.webp",
      "7ds-armes/Epee 1 main/Épée longue noir de jais.webp",
      "7ds-armes/Epee 2 mains/Espadon noir de jais.webp",
      "7ds-armes/Epees doubles/Épées doubles noir de jais.webp",
      "7ds-armes/Gantelets/Gantelets noir de jais.webp",
      "7ds-armes/Hache/Hache noir de jais.webp",
      "7ds-armes/Lance/Lance noir de jais.webp",
      "7ds-armes/Livre/Grimoire noir de jais.webp",
      "7ds-armes/Nunchaku/Nunchaku noir de jais.webp",
      "7ds-armes/Rapiere/Rapière noir de jais.webp"
    ],
    lignes:[
      {
        id:"noir-de-jais-ultime-critique",
        /* Le libelle dit « 1 chance sur 5 » parce que la page prend le
           critique en ESPERANCE et non au tirage : cocher cette case declare
           le tirage GAGNE, pas sa probabilite moyenne. Le taux publie, 20 %,
           n'entre donc dans aucun calcul - il n'est la que pour prevenir. */
        libelle:"Après l'ultime, 1 chance sur 5 : chances crit. +80 % (7 s)",
        stat:"C_Critical_Rate",
        porteur:"hero",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[5000, 5500, 6000, 6500, 7000, 7500, 8000],
        /* L'ancre commence apres le « 20 % de chances » : sans « d' », elle
           attraperait la probabilite au lieu du bonus. */
        provenance:{ phrase:"d'augmenter les chances crit. de " }
      }
    ]
  },
  {
    famille:"Âme vorace",
    armes:["7ds-armes/Gantelets/Gantelets de l'âme vorace.webp"],
    lignes:[
      {
        /* `AllElement_Rate` semble contredire la prose « attaque des
           Tenebres ». Les releves de Derieri tranchent : le bonus majore aussi
           « tous elements ». C'est donc un taux sur toute l'attaque
           elementaire, jamais un bonus de degats.
           La seconde phrase de ce passif ajoute elle aussi un « (Max : » a
           partir du niveau 4. L'ancre du plafond contient donc « pendant 5s. »
           pour ne designer que l'effet d'attaque. */
        id:"gantelets-ame-vorace-barrage-tenebres",
        libelle:"Barrage des Ténèbres : attaque élémentaire +100 %",
        stat:"AllElement_Rate",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[3200, 4800, 5600, 6400, 7200, 8000, 10000],
        parCumul:[80, 120, 140, 160, 180, 200, 250],
        cumuls:40,
        provenance:{
          phrase:"pendant 5s. (Max : ",
          phraseCumul:"augmente l'attaque des Ténèbres de "
        }
      }
    ]
  }
];
