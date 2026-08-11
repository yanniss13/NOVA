/* L'onglet « Calculateur » : les degats de chaque competence contre Akumu.

   Cette vue ne calcule RIEN. Elle lit un build du roster, demande ses bases
   offensives a stats-calcul.js, laisse le membre les retoucher et cocher des
   buffs de soutien, puis confie le tout a calculateur-entrees.js.

   Ce n'est pas un DPS : aucune chronologie, aucun temps d'animation, aucun
   ordre de rotation. C'est un choix, pas un oubli - les donnees qui manquent
   sont precisement celles dont un DPS dependrait. */

import {
  FOLDER_TO_ENUM, LINKED_ARMOR_SLOT, metaOf
} from "../noyau/constantes.js";
import { $, el, numericKeyboardInputProps } from "../noyau/dom.js";
import { sessionCourante } from "../etat/session.js";
import { charOf } from "../metier/catalogue.js";
import { equippedEnumOf } from "../metier/armes.js";
import { rosterHeroSnapshot } from "../metier/equipe-modele.js";
import {
  creerEssaiEnchantements, essaiEnchantementsDiffere,
  herosAvecEssaiEnchantements, reinitialiserEssaiEnchantements,
  remplacerConfigEssai
} from "../metier/essai-enchantements.js";
import {
  activeGearSets, calculateHeroStats, groupBuildStatResults
} from "../metier/stats-calcul.js";
import {
  CIBLES, CONSTANTE_PAR_DEFAUT, PLAFOND_PROPRE, calibrerConstante
} from "../metier/degats-calcul.js";
import { CalibrationStore } from "../donnees/calibration-store.js";
import {
  EMPLACEMENTS_COEQUIPIERS, CoequipiersStore
} from "../donnees/coequipiers-store.js";
import {
  STAT_DE_LA_CATEGORIE, bonusCategorieDesBuffs,
  entreesDeLaCompetence, entreesDuCalcul, resultatsParCompetence,
  resultatsParCompetenceCompares, seauElementaireDeLaStat,
  statsElementairesDuBuild
} from "../metier/calculateur-entrees.js";
import { buffsDeLEquipe } from "../metier/equipe-buffs.js";
import { passifsGravesApplicables } from "../metier/passifs-graves.js";
import { passifsArmesApplicables } from "../metier/passifs-armes.js";
import { passifEnsembleApplicable } from "../metier/passifs-ensembles.js";
import { potentielsEquipeApplicables } from "../metier/potentiels-equipe.js";
import { competenceAvecSupplements,
  degatsSupplementairesApplicables } from "../metier/degats-supplementaires.js";
import {
  buildGearDefinition, buildWeaponDefinition, gearPassiveStatus,
  gearConfigStatus, weaponConfigStatus, weaponPassiveFact
} from "../metier/build-config.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { ModalStack } from "./modal-stack.js";
import { showView } from "./navigation.js";
import { openWeaponConfigEditor } from "./editeur-arme.js";
import { openGearConfigEditor } from "./editeur-equipement.js";

  const NOMBRE = new Intl.NumberFormat("fr-FR");

  /* Les trois bases offensives, et le code de stat qui les porte. */
  /* `taux` dit si la valeur est un POURCENTAGE. Le depot range les taux en
     dix-milliemes, donc 30 % s'y ecrit 3000 : les afficher tels quels sous une
     etiquette « (%) » faisait lire « 3000 % » a un membre a 30 %. La
     conversion se fait ici, a l'affichage et a la saisie, et nulle part
     ailleurs - le moteur ne connait que les dix-milliemes. */
  const BASES = [
    { cle:"atk", code:"B_Atk", label:"ATK" },
    { cle:"critRate", code:"C_Critical_Rate", label:"Taux critique (%)",
      taux:true },
    { cle:"critDamage", code:"C_Critical_Dam_Rate", label:"Dégâts critiques (%)",
      taux:true },
    /* Visible et retouchable comme les autres : il retranche un pourcentage
       de la defense d'Akumu, donc il deplace CHAQUE ligne du tableau. Le
       laisser invisible ferait bouger les chiffres sans que le membre puisse
       voir d'ou vient l'ecart. */
    { cle:"percementDefense", code:"D_Protect_Cur_Rate",
      label:"Percement de défense (%)", taux:true }
  ];

  /* Etat de la page. `retouches` ne contient que ce que le membre a
     REELLEMENT modifie : une cle absente vaut « valeur du build ». */
  const etat = {
    charId:null,
    typeArme:null,
    heroImpose:null,
    /* Le palier d'Akumu affronte par la confrerie, ou le mannequin. Le defaut
       reste le palier 1 : c'etait la cible unique avant que les vingt niveaux
       ne soient releves, et ajouter le choix ne doit deplacer aucun chiffre
       tant que le membre n'a rien touche. */
    cibleId:"akumu-1",
    /* Les coequipiers retenus, restaures du stockage. Trois cases vides par
       defaut : le chiffre reste celui du heros seul tant qu'on n'y touche
       pas. */
    coequipiers:CoequipiersStore.get(),
    retouches:{},
    essaiEnchantements:null,
    etatsEnsembles:{},
    coches:new Set(),
    /* Les passifs qui montent par CUMULS : leur nombre de crans, par
       identifiant. Un etat a part de `coches`, parce qu'une case ne sait dire
       que oui ou non, et que ces passifs-la valent 0, 1, 2 … jusqu'a leur
       plafond. Absent du dictionnaire = zero cumul = eteint. */
    cumuls:{},
    /* La calibration : index de la competence choisie, degats saisis, et le
       dernier message rendu. Le message est garde dans l'etat parce que la
       page se redessine entierement a chaque action. */
    calibrationCompetence:0,
    degatsObserves:"",
    messageCalibration:null
  };

  /* La cible choisie, toujours une entree reelle du catalogue : un identifiant
     devenu inconnu retombe sur le premier palier plutot que de rendre
     `undefined` et de vider tout le tableau. */
  function cibleCourante(){
    return CIBLES.find(cible => cible.id === etat.cibleId) || CIBLES[0];
  }

  /* La SAISIE s'oublie a chaque changement de build ; la constante mesuree,
     elle, reste rangee par build. Garder un message issu d'un autre
     personnage le ferait lire comme s'il portait sur celui-ci. */
  function oublierSaisieCalibration(){
    etat.calibrationCompetence = 0;
    etat.degatsObserves = "";
    etat.messageCalibration = null;
  }

  /* Chaque refus de calibrerConstante() dit au membre QUOI corriger. Un
     « impossible » sec le laisserait sans recours, alors que ces trois cas
     ont chacun une cause concrete et frequente. */
  const MESSAGES_CALIBRATION = {
    "degats-manquants":
      "Entre les dégâts d'un coup non critique.",
    "degats-trop-faibles":
      "Ces dégâts sont trop faibles pour ce build : aucune constante ne les "
      + "produit. Le coup a-t-il été bloqué, ou la cible protégée ?",
    "degats-au-dela-de-la-pre-armure":
      "Ces dégâts dépassent ce que le build peut produire avant armure. "
      + "C'était probablement un coup critique — reprends un coup normal.",
    "defense-nulle":
      "Sans défense sur la cible, aucun coup ne peut révéler la constante.",
    "build-incomplet":
      "Ce build est incomplet, la calibration ne peut pas aboutir."
  };

  let chargementCatalogues = null;

  /* Les deux catalogues sont charges A LA DEMANDE. competences.js fait 7491
     lignes : le charger au demarrage le ferait payer a chaque visiteur qui ne
     calcule rien. Motif repris de js/vues/wiki.js. */
  function chargerCatalogues(){
    if(window.SEVEN_DS_COMPETENCES && window.SEVEN_DS_BUFFS_SUPPORTS
      && window.SEVEN_DS_PASSIFS_GRAVES && window.SEVEN_DS_POTENTIELS_EQUIPE
      && window.SEVEN_DS_DEGATS_SUPPLEMENTAIRES
      && window.SEVEN_DS_PASSIFS_ARMES && window.SEVEN_DS_PASSIFS_ENSEMBLES){
      return Promise.resolve(true);
    }
    if(chargementCatalogues) return chargementCatalogues;
    const injecter = src => new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src, onload:()=>resolve(true),
        onerror:()=>reject(new Error("catalogue introuvable : "+src))
      }));
    });
    chargementCatalogues = Promise.all([
      window.SEVEN_DS_COMPETENCES
        ? Promise.resolve(true) : injecter("./data/competences.js"),
      window.SEVEN_DS_BUFFS_SUPPORTS
        ? Promise.resolve(true) : injecter("./data/buffs-supports.js"),
      window.SEVEN_DS_PASSIFS_GRAVES
        ? Promise.resolve(true) : injecter("./data/passifs-graves.js"),
      window.SEVEN_DS_POTENTIELS_EQUIPE
        ? Promise.resolve(true) : injecter("./data/potentiels-equipe.js"),
      window.SEVEN_DS_DEGATS_SUPPLEMENTAIRES
        ? Promise.resolve(true) : injecter("./data/degats-supplementaires.js"),
      window.SEVEN_DS_PASSIFS_ARMES
        ? Promise.resolve(true) : injecter("./data/passifs-armes.js"),
      window.SEVEN_DS_PASSIFS_ENSEMBLES
        ? Promise.resolve(true) : injecter("./data/passifs-ensembles.js")
    ]).catch(erreur => {
      /* Rejouable : un echec reseau ne doit pas condamner l'onglet pour toute
         la duree de la session. */
      chargementCatalogues = null;
      throw erreur;
    });
    return chargementCatalogues;
  }

  function fichesDuMembre(){
    const user = sessionCourante.user;
    return user ? MemberRosterStore.all(user.id) : [];
  }

  function ficheDe(charId){
    return fichesDuMembre().find(entry => entry.charId === charId) || null;
  }

  function typesDe(entry){
    return entry && entry.builds ? Object.keys(entry.builds).sort() : [];
  }

  /* L'element vient de l'ARME equipee, jamais du personnage : chaque slot
     d'arme porte le sien, et `meta.element` fixe n'existe pas. Piege
     documente dans AGENTS.md. */
  function elementDuBuild(charId, hero){
    const meta = metaOf(charId);
    const equipee = equippedEnumOf(hero);
    const slot = meta && meta.weapons
      ? meta.weapons.find(w => w.weapon === equipee)
      : null;
    return slot && slot.element ? String(slot.element).toLowerCase() : null;
  }

  /* Les bases offensives du build, par code de stat. Un statut autre que
     `valid` ou `partial` ne porte AUCUN chiffre : on rend null plutot qu'un
     zero, et la page dit « Configuration a completer ». */
  function basesDuBuild(hero, element, apportsElementaires){
    const result = calculateHeroStats(hero);
    if(result.status !== "valid" && result.status !== "partial"){
      return { statut:result.status, manques:result.missing || [], stats:null };
    }
    const parCode = new Map(
      groupBuildStatResults(result)
        .flatMap(group => group.stats)
        .map(stat => [stat.stat, stat])
    );
    const lire = code => {
      const stat = parCode.get(code);
      return stat && Number.isFinite(stat.value) ? stat.value : 0;
    };
    /* La seule part du total qui vienne d'un palier de potentiel. Chaque terme
       porte sa provenance depuis stats-calcul.js ; c'est elle qu'on relit,
       plutot que de reparser la prose des paliers une seconde fois. */
    const lirePotentiel = code => {
      const stat = parCode.get(code);
      const termes = stat && Array.isArray(stat.terms) ? stat.terms : [];
      return termes.reduce((somme, terme) => {
        const valeur = Number(terme && terme.value);
        return terme && terme.source && terme.source.domain === "potential"
          && Number.isFinite(valeur) ? somme + valeur : somme;
      }, 0);
    };
    /* Les deux entrees elementaires du build. Le detail des quatre codes
       lus, et de la mesure qui les fonde, vit dans calculateur-entrees.js -
       cette vue ne fait que passer le lecteur de statistiques. */
    const elementaires = statsElementairesDuBuild(
      lire, element, apportsElementaires
    );
    return {
      statut:result.status,
      manques:[],
      stats:{
        atk:lire("B_Atk"),
        def:lire("B_Def"),
        maxHp:lire("B_MaxHp"),
        critRate:lire("C_Critical_Rate"),
        critDamage:lire("C_Critical_Dam_Rate"),
        percementDefense:lire("D_Protect_Cur_Rate"),
        attaqueElementaire:elementaires.attaqueElementaire,
        bonusElementaire:elementaires.bonusElementaire,
        /* « Augmentation de tous les degats » : un bonus qui ne vise aucune
           categorie, donc sa place est dans le seau global plutot que dans
           les cinq seaux par categorie. Voir entreesDuCalcul(). */
        bonusGlobal:lire("I_All_DamAdd_Rate")
      },
      /* A part des autres, et pour une bonne raison : ces cinq bonus ne
         valent QUE pour les competences de leur categorie. Les ranger dans
         `stats` les appliquerait a toutes les lignes du tableau. */
      bonusParCategorie:Object.fromEntries(
        Object.entries(STAT_DE_LA_CATEGORIE)
          .map(([categorie, code]) => [categorie, lire(code) - lirePotentiel(code)])
      ),
      /* Les paliers de potentiel partagent le CODE DE STAT de l'equipement -
         c'est un choix assume du generateur - mais pas son comportement : eux
         multiplient le seau au lieu de s'y ajouter. On les ressort donc du
         total par leur provenance, la seule chose qui les distingue encore. */
      bonusPotentielParCategorie:Object.fromEntries(
        Object.entries(STAT_DE_LA_CATEGORIE)
          .map(([categorie, code]) => [categorie, lirePotentiel(code)])
      )
    };
  }

  /* Les ensembles se reconnaissent par les fichiers deja equipes. Le moteur
     de stats connait leurs vrais seuils, donc cette vue ne doit pas les
     reconstituer a partir des noms de pieces. */
  function ensemblesDuBuild(hero){
    const source = hero || {};
    const fichiers = Object.values(source.armor || {})
      .concat(Object.values(source.jewel || {}));
    return activeGearSets(fichiers);
  }

  /* Tous les builds du roster, un par couple personnage + arme.

     C'est le bon grain : l'arme decide quels buffs le coequipier apporte -
     Daisy au Livre et Daisy a la Baguette n'en donnent pas les memes. Un seul
     choix plutot que deux, donc, et rien a deviner. */
  function buildsDuRoster(){
    return fichesDuMembre()
      .flatMap(fiche => typesDe(fiche).map(typeArme => ({
        charId:fiche.charId,
        typeArme,
        libelle:nomDuPersonnage(fiche.charId) + " · " + typeArme
      })))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  }

  /* L'ATK d'un coequipier, ou null si son build n'est pas exploitable.

     rosterHeroSnapshot rend EXACTEMENT la forme qu'attend calculateHeroStats -
     la meme que pour le heros calcule - donc son potentiel, son arme et sa
     tenue gravee entrent dans ce chiffre sans conversion. */
  function atkDuBuild(heros){
    if(!heros) return null;
    const result = calculateHeroStats(heros);
    if(result.status !== "valid" && result.status !== "partial") return null;
    const trouve = groupBuildStatResults(result)
      .flatMap(groupe => groupe.stats)
      .find(stat => stat.stat === "B_Atk");
    return trouve && Number.isFinite(trouve.value) ? trouve.value : null;
  }

  /* Le build d'un coequipier retenu, ou null si le roster ne le porte plus. */
  function herosDuChoix(choix){
    if(!choix) return null;
    const fiche = ficheDe(choix.charId);
    return fiche ? rosterHeroSnapshot(fiche, choix.typeArme) : null;
  }

  /* Les coequipiers reduits a ce dont equipe-buffs.js a besoin. `null` quand
     aucun emplacement n'est rempli : le module rend alors la liste complete
     des buffs, comme avant tout choix. */
  function coequipiersChoisis(){
    const retenus = etat.coequipiers
      .map(choix => ({ choix, heros:herosDuChoix(choix) }))
      .filter(entree => entree.heros);
    if(!retenus.length) return null;
    return retenus.map(entree => ({
      charId:entree.choix.charId,
      typeArme:entree.choix.typeArme,
      atk:atkDuBuild(entree.heros)
    }));
  }

  /* La tenue gravee d'un build, et le niveau de son passif.

     Le niveau vaut null quand le membre ne l'a pas renseigne : c'est un etat
     normal, que gearPassiveStatus nomme « missing ». Le module pur retombe
     alors sur la valeur plancher. */
  function porteurDeTenue(charId, heros, estLeHeros){
    const tenue = heros && heros.armor
      ? heros.armor[LINKED_ARMOR_SLOT] : null;
    if(!tenue) return null;
    const config = heros.armorConfig
      ? heros.armorConfig[LINKED_ARMOR_SLOT] : null;
    const statut = gearPassiveStatus(buildGearDefinition(tenue), config);
    return {
      charId,
      tenue,
      niveau:statut === "valid" ? config.passiveLevel : null,
      estLeHeros
    };
  }

  /* Le heros calcule d'abord, puis ses coequipiers : le membre lit sa propre
     tenue en tete, avant celles qu'il emprunte. */
  function porteursDeTenues(hero){
    const liste = [porteurDeTenue(etat.charId, hero, true)];
    etat.coequipiers.forEach(choix => {
      if(!choix) return;
      liste.push(porteurDeTenue(choix.charId, herosDuChoix(choix), false));
    });
    return liste.filter(Boolean);
  }

  /* Ce dont potentiels-equipe.js a besoin pour un porteur.

     Le PALIER est commun a toutes les armes d'un personnage - c'est ainsi que
     le roster le stocke - mais la BRANCHE de potentiels, elle, depend de
     l'arme equipee. Les deux voyagent donc ensemble.

     L'ATK sert aux lignes indexees dessus, comme pour les buffs de soutien :
     le palier 10 de Derieri donne « 30 % de l'attaque du heros ». */
  function porteurDePotentiels(charId, typeArme, heros, estLeHeros){
    if(!heros) return null;
    const palier = heros.potentiel ? heros.potentiel.tier : null;
    return { charId, typeArme, palier, atk:atkDuBuild(heros), estLeHeros };
  }

  function porteursDePotentiels(hero){
    const liste = [
      porteurDePotentiels(etat.charId, etat.typeArme, hero, true)
    ];
    etat.coequipiers.forEach(choix => {
      if(!choix) return;
      liste.push(porteurDePotentiels(
        choix.charId, choix.typeArme, herosDuChoix(choix), false
      ));
    });
    return liste.filter(Boolean);
  }

  /* Le roster range ses builds par DOSSIER d'image (« Hache »), le catalogue
     les publie par ENUM (« Axe ») : FOLDER_TO_ENUM fait le pont, et il existe
     deja. */
  function competencesDu(charId, typeArme){
    const enumArme = FOLDER_TO_ENUM[typeArme];
    if(!enumArme) return [];
    const catalogue = window.SEVEN_DS_COMPETENCES || {};
    return (catalogue[charId] || []).filter(c => c.weaponType === enumArme);
  }

  /* Le nom francais et l'icone viennent du catalogue du wiki, joint par
     gameId. Sans equivalent, la ligne GARDE son chiffre et retombe sur le nom
     anglais : un nom anglais se remarque, un chiffre absent se croirait nul. */
  function libelleDe(charId, competence){
    const fiche = ((window.SEVEN_DS_WIKI_COMPETENCES || {})[charId] || [])
      .find(k => k.gameId === competence.gameId);
    return {
      nom:(fiche && fiche.nomFr) || competence.nom || competence.gameId,
      icone:fiche && fiche.icone ? "7ds-ui/skills/" + fiche.icone : null
    };
  }

  function valeurRetouchee(cle, valeurDuBuild){
    return Object.prototype.hasOwnProperty.call(etat.retouches, cle)
      ? etat.retouches[cle]
      : valeurDuBuild;
  }

  function aRetouche(){
    return Object.keys(etat.retouches).length > 0;
  }

  /* ---- rendu ---- */

  function champsDeBase(stats, redessiner){
    const form = el("div",{class:"calc-form"});
    BASES.forEach(base => {
      const courante = valeurRetouchee(base.cle, stats[base.cle]);
      const modifie = Object.prototype.hasOwnProperty.call(etat.retouches, base.cle);
      /* Le type number passe OBLIGATOIREMENT par ce helper : il porte aussi
         inputmode et pattern, sans quoi le clavier mobile n'est pas le bon.
         tests/potentiel-commun.test.js compte les occurrences pour l'imposer. */
      const input = el("input",numericKeyboardInputProps({
        class:"calc-valeur" + (modifie ? " calc-retouche" : ""),
        value:String(base.taux
          ? Math.round(courante) / 100
          : Math.round(courante)),
        onchange:event => {
          const lu = Number(event.target.value);
          if(!Number.isFinite(lu)) return;
          /* Retour aux dix-milliemes AVANT de quitter la vue : une retouche
             rangee en pourcentage se propagerait au moteur, qui la lirait
             cent fois trop petite. */
          etat.retouches[base.cle] = base.taux ? lu * 100 : lu;
          redessiner();
        }
      }));
      form.appendChild(el("div",{class:"calc-champ"},[
        el("label",{text:base.label}),
        input
      ]));
    });
    if(aRetouche()){
      form.appendChild(el("button",{
        class:"btn btn-ghost",
        type:"button",
        text:"Réinitialiser",
        onclick:()=>{ etat.retouches = {}; redessiner(); }
      }));
    }
    return form;
  }

  /* Le catalogue nomme les personnages ; la table des buffs ne connait que
     leur slug. On passe par le catalogue, et on capitalise le slug en dernier
     recours plutot que d'afficher « daisy » a l'ecran. */
  function nomDuPersonnage(slug){
    const perso = charOf(slug) || {};
    return perso.name || perso.nom || perso.nomFr
      || slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  /* Les buffs que l'equipe courante propose.

     UNE seule fonction pour les deux lectures - la liste affichee et les cases
     retenues pour le calcul - parce qu'elles doivent porter les MEMES valeurs.
     Les lire separement ouvrirait la porte a une case qui applique un chiffre
     different de celui qu'elle affiche, et a un buff coche puis exclu qui
     continuerait d'agir. */
  function buffsProposes(element){
    return buffsDeLEquipe({
      element, coequipiers:coequipiersChoisis()
    });
  }

  /* LES QUATRE FONCTIONS DES CUMULS, ecrites une fois pour toutes.

     Une ligne REGLABLE n'est pas cochee, elle est reglee au cran. Tout ce qui,
     ailleurs sur cette page, demandait « cette ligne est-elle cochee ? » doit
     donc passer par ici : la case « tout cocher », le compte affiche, et la
     liste qui part au moteur. Les laisser interroger `etat.coches` directement
     rendrait ces lignes invisibles a l'une ou l'autre.

     `reglable` est pose par la VUE, jamais par les tables, et c'est
     deliberé. Porter `cumuls` ne suffit pas a meriter un selecteur : les buffs
     de soutien en portent aussi, et le combo de Derieri egalement, mais leurs
     sections rendent une case - a 50 crans, le choix a ete fait de declarer le
     combo plein plutot que de derouler cinquante et une lignes. Deduire le
     selecteur du seul champ `cumuls` aurait donc casse ces deux sections en
     silence : elles ecrivent dans `etat.coches`, ces fonctions auraient lu
     `etat.cumuls`, et rien ne se serait plus allume. */
  function reglable(ligne){
    return Boolean(ligne && ligne.reglable && ligne.cumuls);
  }

  function cumulsDe(ligne){
    if(!reglable(ligne)) return 0;
    const lu = Math.round(Number(etat.cumuls[ligne.id]));
    if(!Number.isFinite(lu)) return 0;
    return Math.min(Math.max(0, lu), ligne.cumuls);
  }

  /* « Reglee a fond » vaut « cochee » pour une ligne reglable : c'est ce que
     declare la case « tout cocher », dont l'avertissement dit deja qu'elle
     donne un plafond theorique. */
  function estRetenue(ligne){
    return reglable(ligne)
      ? cumulsDe(ligne) >= ligne.cumuls
      : etat.coches.has(ligne && ligne.id);
  }

  /* La ligne telle que le MOTEUR doit la voir, ou null si elle est eteinte.
     Une ligne reglable voit sa `valeur` recalculee - le pas multiplie par les
     crans declares - pour que rien en aval n'ait a connaitre le mecanisme. */
  function ligneActive(ligne){
    if(!ligne) return null;
    if(!reglable(ligne)){
      return etat.coches.has(ligne.id) ? ligne : null;
    }
    const crans = cumulsDe(ligne);
    return crans > 0
      ? Object.assign({}, ligne, { valeur:ligne.parCumul * crans })
      : null;
  }

  /* Le selecteur qui remplace la case sur une ligne a cumuls. Le libelle perd
     son « +24 % » de plafond au profit de la valeur REELLE du reglage : un
     nombre qui ne bouge pas quand on tourne la molette se lirait comme un
     reglage sans effet. */
  function ligneACumuls(ligne, redessiner){
    const crans = cumulsDe(ligne);
    const choix = el("select",{
      class:"calc-cumuls-choix",
      onchange:event => {
        etat.cumuls[ligne.id] = Number(event.target.value) || 0;
        redessiner();
      }
    });
    for(let n = 0; n <= ligne.cumuls; n++){
      const option = el("option",{ value:String(n), text:String(n) });
      option.selected = n === crans;
      choix.appendChild(option);
    }
    const apport = ligne.parCumul * crans;
    return el("div",{class:"calc-cumul-ligne"},[
      el("span",{class:"calc-cumul-nom",
        text:ligne.libelle.replace(/\s*[+-][\d.,  ]+%\s*$/, "")}),
      el("div",{class:"calc-cumul-reglage"},[
        choix,
        el("span",{class:"calc-cumul-apport",
          text:"/ " + ligne.cumuls + " cumuls — "
            + (crans ? "+" + (apport / 100).toFixed(2).replace(/\.?0+$/, "")
              + " %" : "éteint")})
      ])
    ]);
  }

  function sectionSoutiens(dispo, redessiner){
    const coequipiers = coequipiersChoisis();
    const section = el("section",{class:"calc-soutiens calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Soutiens"}),
      el("p",{class:"calc-avertissement",
        text:"À zéro, le chiffre est celui du héros seul. Cocher un buff ou "
          + "régler ses cumuls, c'est déclarer sa condition remplie : les "
          + "durées ne sont pas modélisées."})
    ]);
    if(!dispo.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:coequipiers
          ? "Aucun membre de cette équipe n'apporte de buff modélisé "
            + "pour l'élément de ce build."
          : "Aucun buff connu ne s'applique à l'élément de ce build."}));
      return section;
    }
    /* REGROUPES PAR SOUTIEN. En liste plate, le nom se repetait sur chacune
       des vingt-quatre lignes et le membre lisait vingt-quatre fois « daisy »
       au lieu de voir cinq blocs. */
    const parSoutien = new Map();
    dispo.forEach(buff => {
      if(!parSoutien.has(buff.support)) parSoutien.set(buff.support, []);
      parSoutien.get(buff.support).push(buff);
    });

    const grilleSoutiens = el("div",{class:"calc-soutiens-grille"});
    parSoutien.forEach((buffs, slug) => {
      const bloc = el("div",{class:"calc-soutien"});
      /* L'arme sur l'EN-TETE, jamais sur chaque ligne : les buffs sont
         regroupes par soutien precisement pour ne pas repeter son nom
         vingt-quatre fois, et avec une equipe ils viennent tous de la meme
         arme. */
      const armeDuGroupe = buffs.find(buff => buff.arme);
      bloc.appendChild(el("h4",{class:"calc-soutien-nom",
        text:armeDuGroupe
          ? nomDuPersonnage(slug) + " · " + armeDuGroupe.arme
          : nomDuPersonnage(slug)}));
      buffs.forEach(buff => {
        if(reglable(buff)){
          bloc.appendChild(ligneACumuls(buff, redessiner));
          if(buff.repli){
            bloc.appendChild(el("p",{class:"calc-muette",
              text:"Build du coéquipier incomplet — valeur plafond."}));
          }
          return;
        }
        /* La case se coche par PROPRIETE, jamais par attribut : `el()` passe
           toute valeur a setAttribute, et setAttribute("checked", undefined)
           ecrit la chaine "undefined" - donc une case cochee. Les six buffs
           sans element l'etaient tous par defaut. */
        const caseACocher = el("input",{
          type:"checkbox",
          onchange:()=>{
            if(etat.coches.has(buff.id)) etat.coches.delete(buff.id);
            else etat.coches.add(buff.id);
            redessiner();
          }
        });
        caseACocher.checked = etat.coches.has(buff.id);
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:buff.libelle})
        ]));
        /* Le repli est DIT : sans cette ligne, un plafond servi faute de build
           lisible se lirait comme une valeur mesuree sur le coequipier. */
        if(buff.repli){
          bloc.appendChild(el("p",{class:"calc-muette",
            text:"Build du coéquipier incomplet — valeur plafond."}));
        }
      });
      grilleSoutiens.appendChild(bloc);
    });
    section.appendChild(grilleSoutiens);

    /* Un coequipier sans buff modelise garde une ligne. Le taire le ferait
       lire comme absent de l'equipe ; le chiffrer a zero le ferait lire comme
       inutile. C'est la meme regle qu'une competence sans coefficient. */
    if(coequipiers){
      const muets = coequipiers
        .filter(membre => !dispo.some(buff => buff.support === membre.charId))
        .map(membre => nomDuPersonnage(membre.charId));
      if(muets.length){
        section.appendChild(el("p",{class:"calc-muette",
          text:"Aucun buff modélisé : " + muets.join(", ") + "."}));
      }
    }
    return section;
  }

  /* Les passifs de tenue gravee. Une section a PART des soutiens, qui restent
     les buffs venus des competences : la tenue du heros calcule n'est pas un
     soutien, et les melanger brouillerait les deux. */
  function sectionTenuesGravees(passifs, redessiner){
    const section = el("section",{class:"calc-tenues calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Tenues gravées"})
    ]);
    if(!passifs.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun passif de tenue gravée ne s'applique à ce build."}));
      return section;
    }
    const parPorteur = new Map();
    passifs.forEach(passif => {
      const cle = passif.support + "|" + passif.tenue;
      if(!parPorteur.has(cle)) parPorteur.set(cle, []);
      parPorteur.get(cle).push(passif);
    });

    const grille = el("div",{class:"calc-soutiens-grille"});
    parPorteur.forEach(lignes => {
      const bloc = el("div",{class:"calc-soutien"});
      const nomTenue = String(lignes[0].tenue).split("/").pop()
        .replace(/\.webp$/, "");
      bloc.appendChild(el("h4",{class:"calc-soutien-nom",
        text:nomDuPersonnage(lignes[0].support) + " · " + nomTenue}));
      lignes.forEach(passif => {
        /* Un passif a paliers se REGLE au lieu de se cocher : sa valeur reelle
           est presque toujours entre zero et son plafond, et la case
           envoyait tout le monde au plafond. */
        if(reglable(passif)){
          bloc.appendChild(ligneACumuls(passif, redessiner));
          if(passif.niveauInconnu){
            bloc.appendChild(el("p",{class:"calc-muette",
              text:"Niveau de passif non renseigné — valeur du niveau 1."}));
          }
          return;
        }
        const caseACocher = el("input",{
          type:"checkbox",
          onchange:()=>{
            if(etat.coches.has(passif.id)) etat.coches.delete(passif.id);
            else etat.coches.add(passif.id);
            redessiner();
          }
        });
        caseACocher.checked = etat.coches.has(passif.id);
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:passif.libelle})
        ]));
        if(passif.niveauInconnu){
          bloc.appendChild(el("p",{class:"calc-muette",
            text:"Niveau de passif non renseigné — valeur du niveau 1."}));
        }
      });
      grille.appendChild(bloc);
    });
    section.appendChild(grille);
    return section;
  }

  /* Les potentiels tournes vers l'equipe. Une section a PART des deux autres,
     parce que la question qu'ils posent au membre est differente : ni « qui
     est dans mon equipe » ni « quelle tenue porte-t-il », mais « jusqu'ou a-t-il
     monte son personnage ». Le palier est ecrit sur chaque ligne pour cette
     raison - c'est le levier sur lequel le membre peut agir. */
  function sectionPotentiels(potentiels, redessiner){
    const section = el("section",{class:"calc-potentiels calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Potentiels d'équipe"})
    ]);
    if(!potentiels.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun potentiel d'équipe ne s'applique à ce build. Les paliers "
          + "des coéquipiers viennent de leur fiche de roster."}));
      return section;
    }
    const parPorteur = new Map();
    potentiels.forEach(ligne => {
      const cle = ligne.support + "|" + ligne.arme;
      if(!parPorteur.has(cle)) parPorteur.set(cle, []);
      parPorteur.get(cle).push(ligne);
    });

    const grille = el("div",{class:"calc-soutiens-grille"});
    parPorteur.forEach(lignes => {
      const bloc = el("div",{class:"calc-soutien"});
      bloc.appendChild(el("h4",{class:"calc-soutien-nom",
        text:nomDuPersonnage(lignes[0].support) + " · " + lignes[0].arme}));
      lignes.forEach(ligne => {
        const caseACocher = el("input",{
          type:"checkbox",
          onchange:()=>{
            if(etat.coches.has(ligne.id)) etat.coches.delete(ligne.id);
            else etat.coches.add(ligne.id);
            redessiner();
          }
        });
        caseACocher.checked = etat.coches.has(ligne.id);
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:"T" + ligne.palier + " — " + ligne.libelle})
        ]));
        if(ligne.repli){
          bloc.appendChild(el("p",{class:"calc-muette",
            text:"ATK du porteur illisible — valeur au plafond."}));
        }
      });
      grille.appendChild(bloc);
    });
    section.appendChild(grille);
    return section;
  }

  /* Ce que porte une ligne d'ensemble, dit en clair. Souverain cupide n'emploie
     que ces deux codes ; un code inconnu se tait plutot que d'afficher son
     identifiant brut a un membre. */
  const LIBELLE_STAT_ENSEMBLE = {
    C_Critical_Rate:"taux critique",
    D_Protect_Cur_Rate:"percement de défense"
  };

  /* CE QUE LE BUFF FAIT REELLEMENT, ET CE QU'IL NE FERA PAS.

     Les deux seules statistiques de Souverain cupide sont muettes sur les
     colonnes Non-crit et Crit : la formule ne les y fait entrer nulle part. Le
     taux critique ne pondere que l'esperance, et le percement ne mord que sur
     une armure - sur le mannequin, degatsAttendus() l'ignore volontairement.

     Un membre qui change d'etat et ne voit aucun chiffre bouger en conclut que
     la page est cassee. Ces lignes existent pour que le silence du tableau soit
     un resultat annonce, et non une panne supposee. */
  function apportDeLEnsemble(scenario, contexte){
    const lignes = scenario.lignes;
    if(!lignes.length) return [];
    const source = contexte || {};
    const cible = source.cible || {};
    const dit = lignes
      .filter(ligne => LIBELLE_STAT_ENSEMBLE[ligne.stat])
      .map(ligne => LIBELLE_STAT_ENSEMBLE[ligne.stat]
        + " +" + (Math.round(ligne.valeur) / 100) + " %");
    const notes = [el("p",{class:"calc-muette",
      text:"Ce buff ajoute " + dit.join(" et ") + "."})];

    const critique = lignes.find(ligne => ligne.stat === "C_Critical_Rate");
    /* Le plafond mord sur le taux NET de la resistance de la cible, comme dans
       degatsAttendus() : l'annoncer sur le taux brut se tromperait contre
       Akumu, dont la resistance critique monte a 122 %. */
    const critNet = (Number(source.critRate) || 0) - (Number(cible.critResist) || 0);
    if(critique && critNet >= PLAFOND_PROPRE){
      notes.push(el("p",{class:"calc-avertissement",
        text:"Taux critique déjà au plafond de "
          + (PLAFOND_PROPRE / 100) + " % : ce bonus n'ajoute rien."}));
    }else if(critique){
      notes.push(el("p",{class:"calc-muette",
        text:"Le taux critique ne déplace que la colonne Espérance — "
          + "jamais Non-crit ni Crit."}));
    }

    const percement = lignes.find(ligne => ligne.stat === "D_Protect_Cur_Rate");
    if(percement && !(Number(cible.def) > 0)){
      notes.push(el("p",{class:"calc-avertissement",
        text:"Sans armure, le percement n'a rien à percer : "
          + "il reste sans effet sur le mannequin."}));
    }
    return notes;
  }

  /* Le set est deja porte par le heros. Son etat temporaire est le seul choix
     local : les trois options remplacent un effet, elles ne se cochent pas. */
  function sectionPassifEnsemble(scenario, redessiner, contexte){
    if(!scenario) return null;
    const section = el("section",{class:"calc-ensembles calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Bonus d'ensemble"}),
      el("p",{class:"calc-avertissement",
        text:scenario.nom + " — palier " + scenario.seuil + " pièces."})
    ]);
    if(scenario.tier === "seven"){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Le palier 7 remplace le buff temporaire du palier précédent."}));
    }
    const choix = el("select",{
      "data-set-passive":scenario.setId,
      onchange:event => {
        etat.etatsEnsembles[scenario.setId] = Number(event.target.value) || 0;
        redessiner();
      }
    });
    ["Aucun buff temporaire", "Après une relève", "Après deux relèves"]
      .forEach((libelle, valeur) => {
        const option = el("option",{value:String(valeur), text:libelle});
        option.selected = valeur === scenario.etat;
        choix.appendChild(option);
      });
    section.appendChild(el("label",{class:"calc-champ"},[
      el("span",{text:"État du bonus"}), choix
    ]));
    apportDeLEnsemble(scenario, contexte)
      .forEach(note => section.appendChild(note));
    return section;
  }

  /* Les passifs de l'arme equipee se reglent au cran : leur duree courte et
     leur origine precise interdisent de les presenter comme un buff d'equipe. */
  function sectionPassifsArmes(passifs, redessiner){
    const section = el("section",{class:"calc-passifs-armes calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Passifs d'arme"})
    ]);
    if(!passifs.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun passif d'arme chiffré ne s'applique à ce build."}));
      return section;
    }
    passifs.forEach(passif => {
      /* Meme partage que les tenues gravees : ce qui monte par crans se
         regle, le reste se coche. Derouler un selecteur de zero a zero sur un
         passif sans cumuls donnerait un reglage qui ne regle rien. */
      if(reglable(passif)){
        section.appendChild(ligneACumuls(passif, redessiner));
      }else{
        const caseACocher = el("input",{
          type:"checkbox",
          onchange:()=>{
            if(etat.coches.has(passif.id)) etat.coches.delete(passif.id);
            else etat.coches.add(passif.id);
            redessiner();
          }
        });
        caseACocher.checked = etat.coches.has(passif.id);
        section.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:passif.libelle})
        ]));
      }
      if(passif.niveauInconnu){
        section.appendChild(el("p",{class:"calc-muette",
          text:"Niveau de passif non renseigné — valeur du niveau 1."}));
      }
    });
    return section;
  }

  /* Tout ce que le membre peut activer sur cette page, dans l'ordre ou il le
     lit. Les degats supplementaires INCONDITIONNELS en sont exclus : ils n'ont
     pas de condition a declarer, puisqu'ils sont deja comptes. */
  function lignesCochables(soutiens, passifsGraves, potentiels, passifsArmes,
                           supplements){
    return soutiens
      .concat(passifsGraves)
      .concat(potentiels)
      .concat(passifsArmes)
      .concat(supplements.filter(ligne => ligne.condition));
  }

  /* « Tout cocher ».

     Ce n'est pas un raccourci anodin, et l'avertissement le dit : cocher une
     case, c'est declarer sa condition remplie. Tout cocher, c'est declarer que
     les cinq sections sont simultanement vraies - Extinction comprise, qui
     double la ligne et ne dure que 5 s, et un combo deja plein alors que le
     premier coup n'est pas parti. Le chiffre obtenu est un PLAFOND theorique,
     pas ce qu'un combat rend.

     Elle ne se contente pas d'ajouter : decochee, elle retire exactement les
     memes identifiants. Vider `etat.coches` en entier effacerait des choix
     portant sur un autre build, que la page reproposera plus tard. */
  function sectionToutCocher(lignes, redessiner){
    const section = el("section",{class:"calc-tout-cocher"});
    if(!lignes.length) return section;
    /* Une ligne a cumuls compte comme cochee quand elle est A FOND, et cette
       case l'y envoie. C'est exactement ce que son avertissement annonce : un
       plafond theorique, pas ce qu'un combat rend. */
    const toutes = lignes.every(estRetenue);
    const caseACocher = el("input",{
      type:"checkbox",
      onchange:()=>{
        lignes.forEach(ligne => {
          if(reglable(ligne)){
            etat.cumuls[ligne.id] = toutes ? 0 : ligne.cumuls;
            return;
          }
          if(toutes) etat.coches.delete(ligne.id);
          else etat.coches.add(ligne.id);
        });
        redessiner();
      }
    });
    caseACocher.checked = toutes;
    /* PAS la classe `calc-buff` : cette case COMMANDE les buffs, elle n'en est
       pas un. Les confondre ferait d'elle le premier element de toute liste de
       buffs - et « cocher le premier buff » cocherait alors la page entiere. */
    section.appendChild(el("label",{class:"calc-tout-cocher-case"},[
      caseACocher,
      el("span",{
        text:"Tout cocher — " + lignes.length + " buff(s) disponible(s)"})
    ]));
    section.appendChild(el("p",{class:"calc-avertissement",
      text:"Toutes conditions déclarées remplies en même temps : c'est un "
        + "plafond théorique, pas ce qu'un combat rend."}));
    return section;
  }

  /* Les degats supplementaires que les potentiels du heros CALCULE ajoutent.
     Aucun ne vient d'un coequipier : « la derniere frappe de SA competence
     normale » ne profite qu'a celui qui frappe. */
  function supplementsDuHeros(hero){
    return degatsSupplementairesApplicables({
      charId:etat.charId,
      typeArme:etat.typeArme,
      palier:hero && hero.potentiel ? hero.potentiel.tier : null
    });
  }

  /* Ceux qui entrent VRAIMENT dans le calcul : les inconditionnels toujours,
     les autres seulement coches. La regle est celle de tout le reste de la
     page - cocher, c'est declarer sa condition remplie - mais elle ne
     s'applique qu'a ce qui a une condition. */
  function supplementsRetenus(supplements){
    return supplements
      .filter(ligne => !ligne.condition || etat.coches.has(ligne.id));
  }

  /* Une section qui MELANGE deux sortes de lignes, a dessein : celles qui
     agissent seules et celles qui attendent une case. Les separer en deux
     blocs aurait laisse croire que les premieres sont facultatives, alors
     qu'elles sont deja dans le chiffre affiche. */
  function sectionSupplements(supplements, redessiner){
    const section = el("section",{class:"calc-supplements calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Dégâts supplémentaires"})
    ]);
    if(!supplements.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucun potentiel de ce build n'ajoute de dégâts à une compétence."}));
      return section;
    }
    supplements.forEach(ligne => {
      const texte = "T" + ligne.palier + " — " + ligne.libelle;
      if(!ligne.condition){
        section.appendChild(el("p",{class:"calc-supplement-actif",
          text:texte + " — compté"}));
        return;
      }
      const caseACocher = el("input",{
        type:"checkbox",
        onchange:()=>{
          if(etat.coches.has(ligne.id)) etat.coches.delete(ligne.id);
          else etat.coches.add(ligne.id);
          redessiner();
        }
      });
      caseACocher.checked = etat.coches.has(ligne.id);
      section.appendChild(el("label",{class:"calc-buff"},[
        caseACocher,
        el("span",{text:texte + " — " + ligne.condition})
      ]));
    });
    return section;
  }

  /* Mesurer C sur un coup reel plutot que de garder la constante par defaut.
     C'est ce qui fait passer la page de « compare deux builds » a « annonce
     un chiffre ». Elle est propre au personnage, a son arme et a ses
     potentiels debloques, donc elle se range par build et se recalibre. */
  function sectionCalibration(competences, entrees, bonusParCategorie, mesuree,
                              redessiner, bonusPotentielParCategorie){
    const section = el("section",{class:"calc-calibration calc-carte"});
    section.appendChild(el("h3",{class:"calc-carte-titre",text:"Constante C"}));
    section.appendChild(el("p",{class:"calc-muette",
      text:mesuree
        ? "Mesurée sur ce build : " + NOMBRE.format(Math.round(mesuree))
          + ". Elle change à chaque potentiel débloqué — recalibre après."
        : "Valeur par défaut : " + NOMBRE.format(CONSTANTE_PAR_DEFAUT)
          + ". Les chiffres classent les builds entre eux, ils n'annoncent "
          + "pas encore ce que tu verras en jeu."}));

    const chiffrees = resultatsParCompetence({
      competences, entrees, bonusParCategorie, bonusPotentielParCategorie,
      cible:cibleCourante()
    }).filter(ligne => ligne.resultat).map(ligne => ligne.competence);

    if(!chiffrees.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Aucune compétence chiffrée ici : rien à calibrer."}));
      return section;
    }

    /* L'index est borne a chaque dessin : changer de personnage ou d'arme
       raccourcit la liste, et un index conserve pointerait dans le vide. */
    const choisi = Math.min(
      Math.max(0, Number(etat.calibrationCompetence) || 0), chiffrees.length - 1
    );
    const choix = el("select",{
      class:"calc-calibration-competence",
      onchange:event => {
        etat.calibrationCompetence = Number(event.target.value) || 0;
      }
    });
    chiffrees.forEach((competence, rang) => {
      const option = el("option",{
        value:String(rang), text:libelleDe(etat.charId, competence).nom
      });
      option.selected = rang === choisi;
      choix.appendChild(option);
    });

    const saisie = el("input",numericKeyboardInputProps({
      class:"calc-valeur",
      value:String(etat.degatsObserves || ""),
      onchange:event => { etat.degatsObserves = event.target.value; }
    }));

    section.appendChild(el("div",{class:"calc-champ"},[
      el("label",{text:"Compétence mesurée"}), choix
    ]));
    section.appendChild(el("div",{class:"calc-champ"},[
      el("label",{text:"Dégâts du coup NON critique"}), saisie
    ]));
    section.appendChild(el("p",{class:"calc-muette",
      text:"Si la compétence affiche plusieurs nombres pour un même coup, "
        + "additionne-les et entre le total."}));

    section.appendChild(el("button",{
      class:"btn", type:"button", text:"Calibrer",
      onclick:()=>{
        const resultat = calibrerConstante({
          /* Les memes entrees que la ligne du tableau, bonus de categorie
             compris : les deux sens de la formule doivent voir le meme seau,
             sinon la constante mesuree corrigerait un ecart imaginaire. */
          stats:entreesDeLaCompetence(
            entrees, bonusParCategorie, chiffrees[choisi],
            bonusPotentielParCategorie
          ),
          competence:chiffrees[choisi],
          cible:cibleCourante(),
          degatsObserves:Number(etat.degatsObserves)
        });
        if(resultat && Number.isFinite(resultat.constante)){
          CalibrationStore.set(etat.charId, etat.typeArme, resultat.constante);
          etat.messageCalibration = "Constante mesurée : "
            + NOMBRE.format(Math.round(resultat.constante))
            + ". Le tableau est recalculé avec elle.";
        } else {
          etat.messageCalibration = MESSAGES_CALIBRATION[resultat && resultat.erreur]
            || "La calibration n'a pas abouti.";
        }
        redessiner();
      }
    }));

    if(mesuree){
      section.appendChild(el("button",{
        class:"btn btn-ghost", type:"button", text:"Oublier la mesure",
        onclick:()=>{
          CalibrationStore.clear(etat.charId, etat.typeArme);
          etat.messageCalibration = null;
          redessiner();
        }
      }));
    }

    if(etat.messageCalibration){
      section.appendChild(el("p",{class:"calc-avertissement calc-calibration-message",
        text:etat.messageCalibration}));
    }
    return section;
  }

  function sectionEssaiEnchantements(hero, essai, redessiner){
    const heroEssai = herosAvecEssaiEnchantements(hero, essai);
    const section = el("section",{class:"calc-essai-enchantements calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Comparer les enchantements"}),
      el("p",{class:"calc-avertissement",
        text:"Cet essai reste dans le calculateur et ne modifie pas ton build enregistré."})
    ]);
    if(aRetouche()){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Les valeurs retouchées peuvent masquer l'écart de l'essai."}));
    }
    const armeValide = weaponConfigStatus(hero.weapon, essai.reference.weaponConfig)
      === "valid";
    const boutonArme = el("button",{
      class:"btn", type:"button", text:"Essayer les enchantements de l'arme",
      onclick:()=>openWeaponConfigEditor({
        weaponFile:hero.weapon,
        config:heroEssai.weaponConfig,
        enchantmentsOnly:true,
        resetConfig:essai.reference.weaponConfig,
        commit:config => {
          etat.essaiEnchantements = remplacerConfigEssai(essai, "weapon", config);
          redessiner();
        }
      }, boutonArme)
    });
    boutonArme.disabled = !armeValide;
    section.appendChild(boutonArme);
    if(!armeValide){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Configuration d'arme à compléter avant de comparer ses enchantements."}));
    }

    const gravure = heroEssai.armor && heroEssai.armor[LINKED_ARMOR_SLOT];
    const configGravure = essai.reference.engravingConfig;
    const gravureValide = gearConfigStatus(gravure, configGravure) === "valid";
    const boutonGravure = el("button",{
      class:"btn", type:"button", text:"Essayer les enchantements de l'armure gravée",
      onclick:()=>openGearConfigEditor({
        file:gravure,
        slotKey:LINKED_ARMOR_SLOT,
        label:"Armure liée",
        config:heroEssai.armorConfig && heroEssai.armorConfig[LINKED_ARMOR_SLOT],
        enchantmentsOnly:true,
        resetConfig:configGravure,
        commit:config => {
          etat.essaiEnchantements = remplacerConfigEssai(essai, "engraving", config);
          redessiner();
        }
      }, boutonGravure)
    });
    boutonGravure.disabled = !gravureValide;
    section.appendChild(boutonGravure);
    if(!gravureValide){
      section.appendChild(el("p",{class:"calc-muette",
        text:"Configuration d'armure gravée à compléter avant de comparer ses enchantements."}));
    }
    if(essaiEnchantementsDiffere(essai)){
      section.appendChild(el("button",{
        class:"btn btn-ghost", type:"button", text:"Réinitialiser l'essai",
        onclick:()=>{
          etat.essaiEnchantements = reinitialiserEssaiEnchantements(essai);
          redessiner();
        }
      }));
    }
    return section;
  }

  function texteEcart(ecart){
    const signe = ecart.absolu >= 0 ? "+" : "−";
    const points = NOMBRE.format(Math.round(Math.abs(ecart.absolu)));
    if(ecart.relatif === null) return signe + points;
    const taux = (Math.abs(ecart.relatif) / 100).toFixed(2).replace(/\.?0+$/, "");
    return signe + points + " — " + signe + taux + " %";
  }

  function celluleComparee(reference, essai, ecart){
    const enfants = [el("span",{text:NOMBRE.format(Math.round(reference))})];
    if(ecart && ecart.absolu !== 0){
      enfants.push(el("small",{
        class:"calc-essai" + (ecart.absolu < 0 ? " calc-essai-negatif" : ""),
        text:"Essai " + NOMBRE.format(Math.round(essai)) + " — " + texteEcart(ecart)
      }));
    }
    return el("td",{class:"calc-valeur"},enfants);
  }

  function tableauDesCompetences(charId, lignes){
    const corps = el("tbody");
    lignes.forEach(ligne => {
      const nom = libelleDe(charId, ligne.competence);
      if(!ligne.resultat){
        corps.appendChild(el("tr",{class:"calc-muette"},[
          el("td",{text:nom.nom}),
          el("td",{colspan:"3", text:"Non inclus dans le calcul"})
        ]));
        return;
      }
      corps.appendChild(el("tr",{},[
        el("td",{text:nom.nom}),
        celluleComparee(
          ligne.resultat.sansCritique,
          ligne.essai && ligne.essai.sansCritique,
          ligne.ecarts && ligne.ecarts.sansCritique
        ),
        celluleComparee(
          ligne.resultat.avecCritique,
          ligne.essai && ligne.essai.avecCritique,
          ligne.ecarts && ligne.ecarts.avecCritique
        ),
        celluleComparee(
          ligne.resultat.total,
          ligne.essai && ligne.essai.total,
          ligne.ecarts && ligne.ecarts.total
        )
      ]));
    });
    /* Le tableau est l'objet de la page : il porte donc son propre panneau,
       plutot que de flotter sur le fond comme une liste parmi d'autres.

       Le <table> lui-meme n'est PAS remplace par des <div> : un tableau de
       nombres reste un tableau, et les tests le lisent en `tbody tr`.
       L'ordre est celui du kit - aucun tri, aucune ligne mise en avant. */
    return el("div",{class:"calc-resultat"},[
      el("div",{class:"calc-resultat-titre",text:"Dégâts par compétence"}),
      el("table",{class:"calc-table"},[
        el("thead",{},[
          el("tr",{},[
            el("th",{text:"Compétence"}),
            el("th",{text:"Non-crit"}),
            el("th",{text:"Crit"}),
            el("th",{text:"Espérance"})
          ])
        ]),
        corps
      ])
    ]);
  }

  function avertissements(){
    return el("section",{class:"calc-avertissement calc-carte"},[
      el("p",{text:cibleCourante().niveau
        ? "Sur Akumu, l'élément ne change rien : les huit résistances "
          + "élémentaires valent 30 % et aucune faiblesse n'est publiée."
        : "Le mannequin n'a ni défense ni résistance : les dégâts affichés "
          + "valent exactement l'ATK multipliée par le coefficient de la "
          + "compétence. La constante C n'y change rien et ne s'y calibre pas."}),
      el("strong",{text:"Non inclus dans le calcul"}),
      el("ul",{},[
        el("li",{text:"les passifs conditionnels du héros et de son équipement"}),
        el("li",{text:"les buffs de coéquipiers non cochés, et la durée de ceux qui le sont"}),
        el("li",{text:"les debuffs appliqués à la cible"}),
        el("li",{text:"les temps d'animation, donc toute notion de dégâts par seconde"}),
        el("li",{text:"les attaques normales, les compétences de relève et les attaques combinées"}),
        el("li",{text:"les mécaniques d'Akumu : pierres élémentaires, attaque dorsale, renforcement à chaque mort"}),
        /* Publiee par la source (20 %, constante sur les vingt paliers) mais
           laissee a zero dans le calcul : voir le commentaire de
           AKUMU_ELEMENTAIRE dans js/metier/degats-calcul.js. Le dire ici plutot
           que de le taire, puisque cela gonfle le percement affiche. */
        el("li",{text:"la résistance au percement du boss (20 %), qui réduirait le percement de défense"})
      ])
    ]);
  }

  /* Le choix de la cible. Vingt paliers d'Akumu, puis le mannequin.

     Le palier change TOUT le tableau — la defense triple entre le 1 et le 10 —
     donc il vit en haut du formulaire, a cote du personnage, et pas dans un
     repli. La constante C calibree, elle, ne depend pas de la cible : elle
     reste valable d'un palier a l'autre. */
  function selecteurCible(redessiner){
    const choix = el("select",{
      class:"calc-cible",
      onchange:event => {
        etat.cibleId = event.target.value;
        /* La saisie de calibration porte sur un coup observe CONTRE une cible
           donnee : la garder en changeant de palier la ferait relire comme si
           elle valait pour le nouveau. */
        oublierSaisieCalibration();
        redessiner();
      }
    });
    CIBLES.forEach(cible => {
      const option = el("option",{
        value:cible.id,
        text:cible.niveau ? "Akumu — niveau " + cible.niveau : cible.nom
      });
      option.selected = cible.id === etat.cibleId;
      choix.appendChild(option);
    });
    return el("div",{class:"calc-champ"},[el("label",{text:"Cible"}), choix]);
  }

  function selecteurCoequipier(index, redessiner){
    const choix = el("select",{
      class:"calc-coequipier",
      onchange:event => {
        const brut = event.target.value || "";
        const separateur = brut.indexOf("|");
        const suivants = etat.coequipiers.slice();
        suivants[index] = separateur > 0
          ? {
              charId:brut.slice(0, separateur),
              typeArme:brut.slice(separateur + 1)
            }
          : null;
        /* Un meme personnage ne peut pas tenir deux sieges : le jeu ne le
           permet pas, et ses buffs se cumuleraient a tort. Le choisir ici le
           retire donc de l'emplacement ou il etait. */
        if(suivants[index]){
          suivants.forEach((autre, rang) => {
            if(rang !== index && autre
              && autre.charId === suivants[index].charId){
              suivants[rang] = null;
            }
          });
        }
        etat.coequipiers = CoequipiersStore.set(suivants);
        /* Changer de coequipier change les buffs PROPOSES : ceux qui etaient
           coches et ne le sont plus n'auraient plus de case pour etre
           decoches, et continueraient d'agir sans rien a l'ecran pour le
           dire. */
        etat.coches.clear();
        redessiner();
      }
    });
    const vide = el("option",{ value:"", text:"—" });
    vide.selected = !etat.coequipiers[index];
    choix.appendChild(vide);
    const builds = buildsDuRoster();
    if(!builds.length) choix.disabled = true;
    builds.forEach(build => {
      const valeur = build.charId + "|" + build.typeArme;
      const retenu = etat.coequipiers[index];
      const option = el("option",{ value:valeur, text:build.libelle });
      option.selected = Boolean(retenu)
        && retenu.charId === build.charId
        && retenu.typeArme === build.typeArme;
      choix.appendChild(option);
    });
    return el("div",{class:"calc-champ"},[
      el("label",{text:"Coéquipier " + (index + 1)}), choix
    ]);
  }

  /* Les trois emplacements, dessines ensemble.

     Le roster est lie au COMPTE : MemberRosterStore rend une liste vide sans
     session. Trois listes vides sans un mot se liraient comme une panne, donc
     on dit pourquoi il n'y a rien a choisir. */
  function selecteursCoequipiers(redessiner){
    const bloc = el("div",{class:"calc-coequipiers"});
    for(let index = 0; index < EMPLACEMENTS_COEQUIPIERS; index++){
      bloc.appendChild(selecteurCoequipier(index, redessiner));
    }
    if(!buildsDuRoster().length){
      bloc.appendChild(el("p",{class:"calc-muette",
        text:"Aucun build dans ton roster : connecte-toi et enregistre un "
          + "build pour pouvoir choisir des coéquipiers."}));
    }
    return bloc;
  }

  function selecteurs(entries, redessiner){
    const bloc = el("div",{class:"calc-form"});
    const choix = el("select",{
      onchange:event => {
        etat.charId = event.target.value;
        const types = typesDe(ficheDe(etat.charId));
        etat.typeArme = types[0] || null;
        etat.retouches = {};
        etat.essaiEnchantements = null;
        etat.etatsEnsembles = {};
        etat.coches.clear();
        oublierSaisieCalibration();
        redessiner();
      }
    });
    entries.forEach(entry => {
      const ch = charOf(entry.charId);
      /* Meme raison que pour les cases a cocher : la selection passe par la
         propriete, pas par un attribut que `el()` ecrirait « undefined ». */
      const option = el("option",{
        value:entry.charId,
        text:ch ? ch.name : entry.charId
      });
      option.selected = entry.charId === etat.charId;
      choix.appendChild(option);
    });
    bloc.appendChild(el("div",{class:"calc-champ"},[
      el("label",{text:"Personnage"}), choix
    ]));

    const types = typesDe(ficheDe(etat.charId));
    const armes = el("div",{class:"calc-champ"},[el("label",{text:"Build"})]);
    const rail = el("div",{class:"calc-armes"});
    types.forEach(type => {
      rail.appendChild(el("button",{
        type:"button",
        class:"btn btn-ghost" + (type === etat.typeArme ? " active" : ""),
        text:type,
        onclick:()=>{
          etat.typeArme = type;
          etat.retouches = {};
          etat.essaiEnchantements = null;
          etat.etatsEnsembles = {};
          oublierSaisieCalibration();
          redessiner();
        }
      }));
    });
    armes.appendChild(rail);
    bloc.appendChild(armes);
    bloc.appendChild(selecteurCible(redessiner));
    bloc.appendChild(selecteursCoequipiers(redessiner));
    return bloc;
  }

  function dessiner(){
    const vue = $("#calculateurBody");
    if(!vue) return;
    vue.textContent = "";

    const entries = fichesDuMembre();

    /* Deux sources possibles, et c'est voulu : un build IMPOSE par le lien
       d'une fiche de heros - qui peut venir d'une equipe locale, sans compte
       ni roster -, ou un build choisi dans le roster du membre connecte.

       Sans le premier cas, le bouton « Calculer les degats » d'une equipe
       locale menerait a « Connecte-toi » : un lien qui ne mene nulle part est
       pire que pas de lien. */
    let hero = null;
    if(etat.heroImpose){
      hero = etat.heroImpose;
      vue.appendChild(el("div",{class:"calc-form"},[
        el("p",{class:"calc-avertissement",
          text:"Build ouvert depuis une fiche de héros."}),
        entries.length
          ? el("button",{
              class:"btn btn-ghost",
              type:"button",
              text:"Choisir dans mon roster",
              onclick:()=>{
                etat.heroImpose = null;
                etat.retouches = {};
                etat.essaiEnchantements = null;
                etat.etatsEnsembles = {};
                etat.coches.clear();
                oublierSaisieCalibration();
                dessiner();
              }
            })
          : null,
        /* Ni la cible ni l'equipe ne dependent du chemin d'entree : un build
           ouvert depuis une fiche de heros se compare aux memes paliers, et
           avec les memes coequipiers, qu'un build choisi dans le roster. */
        selecteurCible(dessiner),
        selecteursCoequipiers(dessiner)
      ]));
    } else {
      if(!entries.length){
        vue.appendChild(el("p",{class:"calc-muette",
          text:sessionCourante.user
            ? "Enregistre d'abord un personnage dans ton roster : le "
              + "calculateur part de tes builds, il n'invente aucune valeur."
            : "Connecte-toi pour calculer les dégâts de tes builds, ou ouvre "
              + "le calculateur depuis la fiche d'un héros."}));
        return;
      }
      if(!etat.charId || !ficheDe(etat.charId)) etat.charId = entries[0].charId;
      const fiche = ficheDe(etat.charId);
      const types = typesDe(fiche);
      if(!etat.typeArme || types.indexOf(etat.typeArme) === -1){
        etat.typeArme = types[0] || null;
      }
      vue.appendChild(selecteurs(entries, dessiner));
      if(!etat.typeArme){
        vue.appendChild(el("p",{class:"calc-muette",
          text:"Ce personnage ne porte aucun build enregistré."}));
        return;
      }
      hero = rosterHeroSnapshot(fiche, etat.typeArme);
    }

    if(!hero){
      vue.appendChild(el("p",{class:"calc-muette",
        text:"Ce build n'a pas pu être lu."}));
      return;
    }

    if(!etat.essaiEnchantements){
      etat.essaiEnchantements = creerEssaiEnchantements(hero);
    }

    const element = elementDuBuild(etat.charId, hero);
    const faitPassifArme = weaponPassiveFact(
      buildWeaponDefinition(hero.weapon), hero.weaponConfig
    );
    /* Un passif qui monte par crans se REGLE ; les autres se cochent, comme
       tout le reste de la page. Le marqueur reste pose par la vue, jamais par
       la table - voir le commentaire de reglable(). */
    const passifsArmes = passifsArmesApplicables({
      fichier:hero.weapon,
      niveau:faitPassifArme && faitPassifArme.level
    }).map(passif => passif.cumuls
      ? Object.assign({}, passif, { reglable:true })
      : passif);
    /* Le partage des destinations appartient au vocabulaire des stats : cette
       vue ne fait que suivre seauElementaireDeLaStat(). Les apports doivent
       etre connus AVANT les bases, qui resolvent deja la somme elementaire.

       `ligneActive` porte les deux formes d'activation : un passif a crans
       rend son pas multiplie par le reglage, un passif a case rend sa valeur
       de niveau, et l'un comme l'autre rendent null quand ils sont eteints. */
    const passifsElementaires = passifsArmes
      .filter(passif => seauElementaireDeLaStat(passif.stat));
    const apportsElementaires = passifsElementaires
      .map(ligneActive)
      .filter(Boolean)
      .reduce((apports, passif) => {
        const seau = seauElementaireDeLaStat(passif.stat);
        apports[seau] += Number(passif.valeur) || 0;
        return apports;
      }, { propre:0, tous:0 });
    const bases = basesDuBuild(hero, element, apportsElementaires);
    if(!bases.stats){
      vue.appendChild(el("p",{class:"calc-muette",
        text:"Configuration à compléter"
          + (bases.manques.length ? " : " + bases.manques.join(", ") : ".")}));
      return;
    }
    const heroEssai = herosAvecEssaiEnchantements(hero, etat.essaiEnchantements);
    const basesEssai = basesDuBuild(heroEssai, element, apportsElementaires);
    const scenarioEnsemble = passifEnsembleApplicable({
      ensembles:ensemblesDuBuild(hero),
      etats:etat.etatsEnsembles,
      setId:"equip_t5_greed"
    });

    vue.appendChild(champsDeBase(bases.stats, dessiner));
    vue.appendChild(sectionEssaiEnchantements(
      hero, etat.essaiEnchantements, dessiner
    ));
    /* Le taux RETOUCHE, pas celui du build : c'est lui qui entrera dans le
       moteur, donc lui qui decide si le plafond mord. */
    const sectionEnsemble = sectionPassifEnsemble(scenarioEnsemble, dessiner, {
      critRate:valeurRetouchee("critRate", bases.stats.critRate),
      cible:cibleCourante()
    });
    if(sectionEnsemble) vue.appendChild(sectionEnsemble);
    if(aRetouche()){
      vue.appendChild(el("p",{class:"calc-avertissement calc-retouche",
        text:"Valeurs retouchées — ne reflète plus ton build."}));
    }

    /* Le marqueur reglable appartient a la vue, jamais aux tables : le meme
       champ `cumuls` ne suffit pas a decrire la presentation voulue. */
    const soutiens = buffsProposes(element).map(buff => buff.cumuls
      ? Object.assign({}, buff, { reglable:true })
      : buff);
    const passifsGraves = passifsGravesApplicables({
      element, porteurs:porteursDeTenues(hero)
    }).map(passif => passif.cumuls
      ? Object.assign({}, passif, { reglable:true })
      : passif);
    const potentiels = potentielsEquipeApplicables({
      element, porteurs:porteursDePotentiels(hero)
    });
    const supplements = supplementsDuHeros(hero);

    /* TOUT COCHER d'abord, au-dessus des cinq sections qu'elle commande :
       le membre lit ce qu'elle fait avant de voir les cases, pas apres. */
    vue.appendChild(sectionToutCocher(
      lignesCochables(
        soutiens, passifsGraves, potentiels, passifsArmes, supplements
      ),
      dessiner
    ));
    vue.appendChild(sectionSoutiens(soutiens, dessiner));
    vue.appendChild(sectionTenuesGravees(passifsGraves, dessiner));
    vue.appendChild(sectionPotentiels(potentiels, dessiner));
    vue.appendChild(sectionPassifsArmes(passifsArmes, dessiner));
    vue.appendChild(sectionSupplements(supplements, dessiner));

    /* Les sources cochees portent une stat ou un effet lisible par le moteur.
       Le taux ELEMENTAIRE des passifs d'arme n'y entre pas : il a deja ete
       applique aux bases, avant cette liste. Les autres passifs d'arme, si :
       leurs codes - taux d'attaque, taux critique, vulnerabilite - sont
       precisement ceux qu'entreesDuCalcul sait ranger. */
    const lignesEnsemble = scenarioEnsemble ? scenarioEnsemble.lignes : [];
    const armesCochables = passifsArmes
      .filter(passif => !seauElementaireDeLaStat(passif.stat));
    const coches = soutiens
      .concat(passifsGraves)
      .concat(potentiels)
      .concat(armesCochables)
      .map(ligneActive)
      .filter(Boolean)
      .concat(lignesEnsemble);

    /* Les bonus de categorie du BUILD et ceux des buffs coches s'ADDITIONNENT :
       ils viennent de sources differentes - potentiels, equipement, tenue
       gravee, soutiens - et le jeu les cumule. */
    const bonusDesBuffs = bonusCategorieDesBuffs(coches);
    const bonusParCategorie = Object.assign({}, bases.bonusParCategorie);
    Object.keys(bonusDesBuffs).forEach(categorie => {
      bonusParCategorie[categorie] =
        (Number(bonusParCategorie[categorie]) || 0) + bonusDesBuffs[categorie];
    });
    /* Le compte annonce ce que le membre a ACTIVE, donc les degats
       supplementaires conditionnels en font partie : ils ne passent pas par
       `coches`, mais une case cochee qui n'apparaitrait pas dans le total
       donnerait l'impression de n'avoir rien fait. Un passif regle a un cumul
       compte pour un, comme une case : c'est bien une ligne de plus qui agit
       sur le chiffre. */
    /* Seuls les passifs d'arme ELEMENTAIRES s'ajoutent a la main : les autres
       voyagent deja dans `coches`, et les compter ici les compterait deux
       fois - une ligne activee en vaudrait deux dans l'annonce. */
    const cochesVisibles = coches.length - lignesEnsemble.length
      + passifsElementaires.map(ligneActive).filter(Boolean).length
      + supplements.filter(l => l.condition && etat.coches.has(l.id)).length
      + (scenarioEnsemble && scenarioEnsemble.etat > 0 ? 1 : 0);
    /* « ligne(s) active(s) » couvre aussi les passifs regles au cran, qui ne
       viennent pas forcement d'un coequipier et ne cochent aucune case. */
    vue.appendChild(el("p",{class:"calc-avertissement",
      text:cochesVisibles
        ? "Avec " + cochesVisibles + " ligne(s) active(s)."
        : "Héros seul."}));

    const statsRetouchees = Object.assign({}, bases.stats);
    const statsEssaiRetouchees = Object.assign({}, basesEssai.stats || bases.stats);
    BASES.forEach(base => {
      statsRetouchees[base.cle] = valeurRetouchee(base.cle, bases.stats[base.cle]);
      statsEssaiRetouchees[base.cle] = valeurRetouchee(
        base.cle, statsEssaiRetouchees[base.cle]
      );
    });

    const entrees = entreesDuCalcul({
      statsDuBuild:statsRetouchees, buffsCoches:coches
    });
    /* La constante mesurée, quand ce build en a une. Absente, le moteur
       retombe sur sa valeur par défaut - c'est lui qui décide de son repli,
       pas cette vue. */
    const mesuree = CalibrationStore.get(etat.charId, etat.typeArme);
    if(mesuree) entrees.constanteC = mesuree;
    const bonusParCategorieEssai = Object.assign({}, basesEssai.bonusParCategorie);
    Object.keys(bonusDesBuffs).forEach(categorie => {
      bonusParCategorieEssai[categorie] =
        (Number(bonusParCategorieEssai[categorie]) || 0) + bonusDesBuffs[categorie];
    });
    const entreesEssai = entreesDuCalcul({
      statsDuBuild:statsEssaiRetouchees, buffsCoches:coches
    });
    if(mesuree) entreesEssai.constanteC = mesuree;

    /* Les degats qu'un potentiel AJOUTE aux competences du heros. Ils ne se
       cochent pas quand ils sont inconditionnels : ils font partie du kit au
       meme titre que les +115 % du palier, et rien a l'ecran ne demanderait au
       membre de confirmer que sa derniere frappe frappe. */
    const competences = competencesDu(etat.charId, etat.typeArme)
      .map(competence => competenceAvecSupplements(
        competence, supplementsRetenus(supplements)
      ));
    if(!competences.length){
      vue.appendChild(el("p",{class:"calc-muette",
        text:"Aucune compétence connue pour ce type d'arme."}));
    } else {
      const lignesReference = resultatsParCompetence({
        competences, entrees, bonusParCategorie,
        bonusPotentielParCategorie:bases.bonusPotentielParCategorie,
        cible:cibleCourante()
      });
      const lignesEssai = resultatsParCompetence({
        competences, entrees:entreesEssai, bonusParCategorie:bonusParCategorieEssai,
        bonusPotentielParCategorie:basesEssai.bonusPotentielParCategorie,
        cible:cibleCourante()
      });
      vue.appendChild(tableauDesCompetences(
        etat.charId, resultatsParCompetenceCompares(lignesReference, lignesEssai)
      ));
      vue.appendChild(sectionCalibration(
        competences, entrees, bonusParCategorie, mesuree, dessiner,
        bases.bonusPotentielParCategorie
      ));
    }
    vue.appendChild(avertissements());
  }

  function renderCalculateur(){
    return chargerCatalogues()
      .then(()=>{ dessiner(); return true; })
      .catch(()=>{
        const vue = $("#calculateurBody");
        if(vue){
          vue.textContent = "";
          vue.appendChild(el("p",{class:"calc-muette",
            text:"Le catalogue de compétences n'a pas pu être chargé. "
              + "Réessaie en rouvrant l'onglet."}));
        }
        return true;
      });
  }

  /* Ouverture ciblee depuis la fiche de heros : la page s'ouvre sur le build
     qu'on regardait. */
  function ouvrirCalculateur(charId, typeArme, hero){
    etat.charId = charId || null;
    etat.typeArme = typeArme || null;
    etat.heroImpose = hero || null;
    etat.retouches = {};
    etat.essaiEnchantements = null;
    etat.etatsEnsembles = {};
    etat.coches.clear();
    oublierSaisieCalibration();
    /* Le lien part d'une fiche ouverte DANS une modale. Sans cette fermeture,
       la page s'afficherait derriere elle et le document resterait fige. */
    ModalStack.closeAll();
    return showView("calculateur");
  }

/* L'enregistrement de la vue se fait dans js/app.js, comme pour toutes les
   autres : c'est lui qui connait l'ordre de demarrage. */
export { ouvrirCalculateur, renderCalculateur };
