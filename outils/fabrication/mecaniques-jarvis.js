"use strict";

/* Les effets du jeu et ses regles, que /jarvis consulte : logique PURE.

   Elle recoit les tables deja lues et rend l'objet a deposer dans le bucket
   prive `jarvis-prive`. Aucun acces disque ici : `extraire-mecaniques.js`
   lit l'export, et les tests lui tendent un mini-export.

   LA CHAINE, verifiee sur l'export du 24/09/2026 :
     BuffTable[id].Local_Key / Local_Desc -> Localization fr (sans la casse)
     Competence -> effets : par le NOM. Les comportements de
       PC_SkillBehaviorTable s'appellent comme l'identifiant de la
       competence (data/wiki-competences.js), ou le prolongent par « _ ».
       BehaviorDetail_SetBuffTid[] donne BuffTid et BuffTime (ms).
     TutorialLogGroupTable + TutorialLogTable, GuidePopupGroupTable +
       GuidePopupTable -> les regles, dans les mots du jeu. */

const { lecteurDeTextes, enListe } = require("./monstres-jarvis.js");

const ELEMENTS_MECANIQUES = {
  Default:"Physique", Thunder:"Foudre", Wind:"Vent", Fire:"Feu",
  Ice:"Glace", Earth:"Terre", Dark:"Ténèbres", Holy:"Sacré"
};
/* Absentes de libelles-stats.json, en dix-milliemes (etabli au lot 2a). */
const FAMILLE_ELEMENTAIRE = /^(Default|Thunder|Wind|Fire|Ice|Earth|Dark|Holy)_(Weakness_Rate|Element_Res_Rate)$/;
const BALISES_MECANIQUES = /\[#?[-0-9A-Fa-f]*\]/g;

function nettoyerMecanique(texte) {
  return String(texte || "")
    .replace(BALISES_MECANIQUES, "")
    .replace(/\{Inputkey_[^}]*\}/gi, "(touche)")
    /* {0}, {1}, et aussi {time} (« Expédition de familier ») : une valeur
       que le jeu remplit a l'affichage. */
    .replace(/\{\w+\}/g, "X")
    .trim();
}

function sansAccentsMecanique(texte) {
  return String(texte || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/* Le controle d'abord : Petrification est un DeBuff de DetailType StateCC. */
function natureDuBuff(buff) {
  if(String(buff.DetailType) === "EBuffType::StateCC"
    || String(buff.Type) === "EBuffDivision::SystemDebuff") return "controle";
  if(String(buff.Type) === "EBuffDivision::DeBuff") return "malus";
  return "buff";
}

/* « Team » sur un malus n'a pas de sens etabli : un malus vise l'ennemi. */
function cibleDuBuff(buff, nature) {
  if(nature !== "buff") return "ennemi";
  return String(buff.ApplyType) === "EApplyType::Team" ? "equipe" : "porteur";
}

function cleCanoniqueMecanique(code) {
  return String(code || "").toLocaleLowerCase("fr").replace(/[^a-z0-9]/g, "");
}

function entreeParCodeMecanique(table, code) {
  if(table[code]) return table[code];
  const canonique = cleCanoniqueMecanique(code);
  const cle = Object.keys(table).find(candidate => cleCanoniqueMecanique(candidate) === canonique);
  return cle ? table[cle] : null;
}

function libelleStatMecanique(code, libelles) {
  const connu = entreeParCodeMecanique(libelles, code);
  if(connu && (connu.court || connu.fr)) return connu.court || connu.fr;
  const famille = FAMILLE_ELEMENTAIRE.exec(code);
  if(famille){
    return (famille[2] === "Weakness_Rate" ? "Dégâts de faiblesse " : "Résistance élémentaire ")
      + ELEMENTS_MECANIQUES[famille[1]];
  }
  return code;
}

function remplacementsDuBuff(buff) {
  return (buff.Local_Replace || []).map(remplacement => {
    const trouve = /^\{(\d+)\}:\{([+-]?\d+(?:[.,]\d+)?)(%)?\}$/.exec(String(remplacement).trim());
    if(!trouve) return null;
    return {
      index:Number(trouve[1]),
      nombre:Number(trouve[2].replace(",", ".")),
      unite:trouve[3] ? "ten-thousandths" : "flat",
      affichage:trouve[2].replace(".", ",") + (trouve[3] ? " %" : "")
    };
  }).filter(Boolean);
}

function uniteProuveePourAjout(ajout, remplacements, unites) {
  const code = String(ajout && ajout.TargetAbil || "").replace("EAbilityType::", "");
  const valeur = Number(ajout && ajout.Value) || 0;
  const correspondances = remplacements.filter(remplacement =>
    remplacement.unite === "ten-thousandths"
      ? Math.abs(Math.abs(remplacement.nombre) * 100 - Math.abs(valeur)) < 1e-9
      : Math.abs(Math.abs(remplacement.nombre) - Math.abs(valeur)) < 1e-9);
  const unitesLocales = [...new Set(correspondances.map(remplacement => remplacement.unite))];
  if(unitesLocales.length === 1) return { unite:unitesLocales[0], rapprochee:true };
  if(String(ajout && ajout.Type) === "EAbilityStatValueType::Per"){
    return { unite:"ten-thousandths", rapprochee:correspondances.length > 0 };
  }
  const metadata = entreeParCodeMecanique(unites, code);
  const unite = (metadata && metadata.unit)
    || (FAMILLE_ELEMENTAIRE.test(code) ? "ten-thousandths" : null);
  return { unite, rapprochee:correspondances.length > 0 };
}

/* L'unite ne se devine jamais d'apres le nom du code : remplacement local,
   operation Per, stat-metadata.json ou famille elementaire etablie. */
function valeurLisibleMecanique(valeur, unite) {
  const signe = valeur > 0 ? "+" : "";
  if(unite === "ten-thousandths"){
    return signe + String(Number((valeur / 100).toFixed(2))).replace(".", ",") + " %";
  }
  if(unite === "flat") return signe + valeur;
  return valeur + " (valeur brute)";
}

function valeursDuBuff(buff, libelles, unites) {
  const remplacements = remplacementsDuBuff(buff);
  const resultat = { valeurs:[], prouvees:0, brutes:0, desaccords:0 };
  (buff.AddAbil_List || []).forEach(ajout => {
    const code = String(ajout && ajout.TargetAbil || "").replace("EAbilityType::", "");
    const valeur = Number(ajout && ajout.Value) || 0;
    if(!code || code === "None" || !valeur) return;
    const preuve = uniteProuveePourAjout(ajout, remplacements, unites);
    resultat.valeurs.push({
      stat:libelleStatMecanique(code, libelles),
      valeur:valeurLisibleMecanique(valeur, preuve.unite)
    });
    if(preuve.unite) resultat.prouvees += 1;
    else resultat.brutes += 1;
    if(remplacements.length && !preuve.rapprochee) resultat.desaccords += 1;
  });
  return resultat;
}

function texteAfficheDuBuff(buff, lire) {
  let texte = String(lire(buff.Local_Desc) || "");
  remplacementsDuBuff(buff).forEach(remplacement => {
    texte = texte.replace(new RegExp("\\{" + remplacement.index + "\\}", "g"), remplacement.affichage);
  });
  return nettoyerMecanique(texte);
}

/* Nom de comportement -> competence. Le plus long identifiant gagne : si un
   jour « x_skill_q_ex » existe a cote de « x_skill_q », « x_skill_q_ex_a »
   revient au premier. */
function proprietairesDesComportements(competences, comportements) {
  const candidates = [];
  Object.entries(competences || {}).forEach(([slug, liste]) => {
    (liste || []).forEach(competence => {
      if(competence && competence.gameId) candidates.push({ slug, competence });
    });
  });
  candidates.sort((a, b) => b.competence.gameId.length - a.competence.gameId.length);
  const proprietaires = new Map();
  Object.keys(comportements || {}).forEach(nom => {
    const trouve = candidates.find(({ competence }) =>
      nom === competence.gameId || nom.startsWith(competence.gameId + "_"));
    if(trouve) proprietaires.set(nom, trouve);
  });
  return proprietaires;
}

function porteurDeCompetence(proprietaire, personnages, nomEffet) {
  const { slug, competence } = proprietaire;
  const personnage = (personnages || {})[slug] || {};
  const arme = (personnage.armes || []).find(entree => entree && entree.type === competence.weaponType);
  return {
    heros:personnage.nom || slug,
    arme:arme ? arme.arme : String(competence.weaponType || ""),
    competence:competence.nomFr,
    categorie:competence.categorie,
    citeParDescription:sansAccentsMecanique(nettoyerMecanique(competence.descriptionFr))
      .includes(sansAccentsMecanique(nomEffet))
  };
}

function cleDePorteur(porteur) {
  return porteur.heros + "|" + porteur.arme + "|" + porteur.competence;
}

function reglesDuJeu(entree, lire) {
  const parSujet = new Map();
  function ajouter(titre, pages) {
    const sujet = nettoyerMecanique(titre);
    const propres = pages.map(nettoyerMecanique).filter(Boolean);
    if(!sujet || !propres.length) return;
    const liste = parSujet.get(sujet) || [];
    propres.forEach(page => { if(!liste.includes(page)) liste.push(page); });
    parSujet.set(sujet, liste);
  }
  const pagesJournal = Object.values(entree.pagesJournal || {});
  Object.entries(entree.journal || {}).forEach(([id, groupe]) => {
    ajouter(lire(groupe && groupe.Local_Key), pagesJournal
      .filter(page => page && page.Group_Tid === id)
      .sort((a, b) => (Number(a.List_Sort) || 0) - (Number(b.List_Sort) || 0))
      .map(page => lire(page.Pc_Desc_Local)));
  });
  const pagesGuides = entree.pagesGuides || {};
  Object.values(entree.guides || {}).forEach(groupe => {
    ajouter(lire(groupe && groupe.Title_Local), enListe(groupe && groupe.Group_Value)
      .flatMap(id => enListe(pagesGuides[id] && pagesGuides[id].Pc_Desc_Local))
      .map(lire));
  });
  ajouter("Astuces de chargement", Object.keys(entree.textes || {})
    .map(cle => [cle, /^ui_loadingtip_desc_(\d+)$/i.exec(cle)])
    .filter(([, numero]) => numero)
    .sort((a, b) => Number(a[1][1]) - Number(b[1][1]))
    .map(([cle]) => lire(cle)));
  return [...parSujet].map(([sujet, pages]) => ({ sujet, pages }))
    .sort((a, b) => a.sujet.localeCompare(b.sujet, "fr"));
}

function construireCatalogueMecaniques(entree) {
  const lireBrut = lecteurDeTextes(entree.textes);
  /* Une traduction absente rend parfois la cle elle-meme
     (« local_buff_atk_increase02_name ») : ce n'est pas un texte. */
  const lire = cle => {
    const texte = lireBrut(cle);
    return texte && texte.toLowerCase() === String(cle).toLowerCase() ? null : texte;
  };
  const libelles = entree.libelles || {};
  const unites = entree.unites || {};
  const buffs = entree.buffs || {};

  /* Les buffs nommes. Le jeu reutilise un nom pour des buffs de natures et
     de descriptions differentes (« Augmentation des degats crit. » dit
     « heros Vent » sur l'un, rien sur l'autre) : chaque variante garde les
     siennes. */
  const nommes = new Map();
  Object.keys(buffs).sort((a, b) => Number(a) - Number(b)).forEach(id => {
    const brut = buffs[id];
    const nom = brut && nettoyerMecanique(lire(brut.Local_Key));
    if(!nom) return;
    const nature = natureDuBuff(brut);
    const cumul = Number(brut.StackType && brut.StackType.MaxStack) || 0;
    const valeurs = valeursDuBuff(brut, libelles, unites);
    const info = {
      nom, nature, rang:Number(id),
      description:nettoyerMecanique(lire(brut.Local_Desc)),
      valeurs:valeurs.valeurs,
      controleValeurs:{ prouvees:valeurs.prouvees, brutes:valeurs.brutes, desaccords:valeurs.desaccords },
      cumulMax:cumul > 0 ? cumul : undefined,
      cible:cibleDuBuff(brut, nature)
    };
    if(valeurs.desaccords){
      const texteJeu = texteAfficheDuBuff(brut, lire);
      if(texteJeu) info.texteJeu = texteJeu;
    }
    nommes.set(id, info);
  });

  const variantesParNom = new Map();
  function variante(id, dureeMs) {
    const info = nommes.get(id);
    if(!variantesParNom.has(info.nom)) variantesParNom.set(info.nom, new Map());
    const variantes = variantesParNom.get(info.nom);
    const duree = dureeMs > 0 ? Number((dureeMs / 1000).toFixed(2)) : undefined;
    const cle = JSON.stringify([info.valeurs, duree === undefined ? null : duree,
      info.cumulMax === undefined ? null : info.cumulMax, info.cible, info.nature, info.description,
      info.texteJeu || null]);
    let courante = variantes.get(cle);
    if(!courante){
      courante = { valeurs:info.valeurs };
      if(duree !== undefined) courante.duree = duree;
      if(info.cumulMax !== undefined) courante.cumulMax = info.cumulMax;
      courante.cible = info.cible;
      courante.nature = info.nature;
      courante.description = info.description;
      if(info.texteJeu) courante.texteJeu = info.texteJeu;
      courante.posePar = [];
      courante.rang = info.rang;
      courante.controleValeurs = info.controleValeurs;
      variantes.set(cle, courante);
    }
    courante.rang = Math.min(courante.rang, info.rang);
    return courante;
  }

  const proprietaires = proprietairesDesComportements(entree.competences, entree.comportements);
  const appliques = new Set();
  Object.keys(entree.comportements || {}).sort().forEach(nomComportement => {
    const proprietaire = proprietaires.get(nomComportement);
    if(!proprietaire) return;
    (entree.comportements[nomComportement].BehaviorDetail_SetBuffTid || []).forEach(pose => {
      const id = String(pose && pose.BuffTid);
      if(!nommes.has(id)) return;
      appliques.add(id);
      const courante = variante(id, Number(pose.BuffTime));
      const porteur = porteurDeCompetence(proprietaire, entree.personnages, nommes.get(id).nom);
      if(!courante.posePar.some(deja => cleDePorteur(deja) === cleDePorteur(porteur))){
        courante.posePar.push(porteur);
      }
    });
  });
  /* Un effet que ne pose aucune competence de heros reste au glossaire :
     il repond a « c'est quoi Gel ? ». */
  nommes.forEach((info, id) => { if(!appliques.has(id)) variante(id, -1); });

  const controleValeurs = { prouvees:0, brutes:0, desaccords:0 };
  const effets = [...variantesParNom].map(([nom, variantes]) => {
    const triees = [...variantes.values()]
      .sort((a, b) => Number(b.posePar.length > 0) - Number(a.posePar.length > 0) || a.rang - b.rang)
      .map(({ rang, controleValeurs:controle, ...reste }) => {
        Object.keys(controleValeurs).forEach(cle => { controleValeurs[cle] += controle[cle]; });
        return Object.assign(reste, {
          posePar:reste.posePar.sort((a, b) =>
            a.heros.localeCompare(b.heros, "fr") || a.competence.localeCompare(b.competence, "fr"))
        });
      });
    /* L'effet prend la nature et la description de sa premiere variante,
       celle qu'un heros pose d'abord : c'est d'elle qu'un membre parle. */
    return { nom, nature:triees[0].nature, description:triees[0].description, variantes:triees };
  }).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return {
    version:1,
    genereLe:entree.genereLe,
    dateExport:entree.dateExport,
    controleValeurs,
    effets,
    regles:reglesDuJeu(entree, lire)
  };
}

function resumeControleValeurs(catalogue) {
  const controle = catalogue.controleValeurs;
  return "Valeurs prouvées : " + controle.prouvees + " ; valeurs brutes : " + controle.brutes
    + " ; désaccords texte/table : " + controle.desaccords + ".";
}

module.exports = { construireCatalogueMecaniques, resumeControleValeurs };
