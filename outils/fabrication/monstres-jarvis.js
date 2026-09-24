"use strict";

/* Le catalogue des monstres que /jarvis consulte : logique PURE.

   Elle recoit les tables deja lues et rend l'objet a deposer dans le bucket
   prive `jarvis-prive`. Aucun acces disque ici : `extraire-monstres.js` lit
   l'export, et les tests lui tendent un mini-export.

   LA CHAINE, verifiee sur l'export du 24/09/2026 :
     MonsterActorTable[id].Local_Key -> Localization fr (cle sans la casse)
     MonsterActorTable[id].StatGroupTid -> NpcStatGroupTable
     BossStatGroupTable (Boss_Tid, Stat_Level, Stat_Group) -> les paliers
       d'un boss de confrerie. L'acteur d'Akumu pointe sur le groupe de test :
       ses paliers sont sa seule vraie source.

   Signe, confirme en jeu : <Element>_Weakness_Rate > 0 est une faiblesse,
   < 0 une resistance. Les valeurs restent brutes (dix-milliemes) : c'est le
   module du bot qui les met en mots. */

const ELEMENTS_EXTRACTION = ["Default", "Thunder", "Wind", "Fire", "Ice", "Earth", "Dark", "Holy"];
const GROUPE_DE_TEST = "stat_poweroverwhelming";
const RANGS_EXTRACTION = { "EActorGrade::Boss":"boss", "EActorGrade::Elite":"elite" };
const ORDRE_RANGS = ["normal", "elite", "boss"];
const ORDRE_CONTEXTES_EXTRACTION = ["confrerie", "terrain", "donjon", "cross", "zone"];
const TYPES_DONJON = {
  Normal:"donjon", Raid:"raid", Stella:"Stella", Boss_Replay:"boss rejouable",
  Boss_Replay_Event:"boss rejouable, événement", Boss_Guild:"boss de confrérie",
  Boss_Guild_Training:"entraînement de confrérie", Hero:"héros",
  Normal_Event:"événement", Combat:"combat", Subjugation:"soumission"
};

function lecteurDeTextes(textes) {
  const index = new Map();
  Object.entries(textes || {}).forEach(([cle, valeur]) => index.set(cle.toLowerCase(), valeur));
  return cle => {
    if(!cle || cle === "None") return null;
    const valeur = index.get(String(cle).toLowerCase());
    return typeof valeur === "string" && valeur.trim() ? valeur.trim() : null;
  };
}

function enListe(valeur) {
  if(valeur === undefined || valeur === null || valeur === "None") return [];
  return [].concat(valeur).map(String).filter(texte => texte && texte !== "None");
}

function statsDuGroupeExtraction(groupe) {
  const lire = code => Number(groupe[code]) || 0;
  const parElement = suffixe =>
    Object.fromEntries(ELEMENTS_EXTRACTION.map(element => [element, lire(element + suffixe)]));
  return {
    faiblesses:parElement("_Weakness_Rate"),
    resistances:parElement("_Element_Res_Rate"),
    pv:lire("B_MaxHp"), defense:lire("B_Def"), attaque:lire("B_Atk"),
    resCrit:lire("C_Critical_ResRate"), defCrit:lire("C_Critical_DamRes_Rate"),
    blocage:lire("A_Block"), reducBlocage:lire("D_Block_DamRes_Rate"),
    reducTous:lire("D_All_DamRes_Rate")
  };
}

function puissanceExtraction(acteur) {
  const sortie = {};
  (acteur.Recommend_BattlePower || []).forEach(palier => {
    const niveau = /(\d+)$/.exec(String(palier && palier.StandardWorldLevelTID || ""));
    const valeur = Number(palier && palier.BattlePower);
    if(niveau && valeur > 0) sortie[String(Number(niveau[1]))] = valeur;
  });
  return Object.keys(sortie).length ? sortie : null;
}

function prioriteContexte(contexte) {
  return ORDRE_CONTEXTES_EXTRACTION.indexOf(contexte.type);
}

function trierContextes(liste) {
  return liste.sort((a, b) =>
    prioriteContexte(a) - prioriteContexte(b) || a.libelle.localeCompare(b.libelle, "fr"));
}

/* Tous les contextes de chaque acteur : ou le joueur le rencontre. */
function contextesParActeur(entree, texte) {
  const parActeur = new Map();
  const ajouter = (id, contexte) => {
    const cle = String(id);
    if(!parActeur.has(cle)) parActeur.set(cle, []);
    const liste = parActeur.get(cle);
    if(!liste.some(deja => deja.libelle === contexte.libelle)) liste.push(contexte);
  };

  Object.values(entree.paliersBoss || {}).forEach(palier =>
    ajouter(palier.Boss_Tid, { type:"confrerie", libelle:"Boss de confrérie" }));
  Object.values(entree.bossTerrain || {}).forEach(boss =>
    enListe(boss.FieldBossTid).forEach(id =>
      ajouter(id, { type:"terrain", libelle:"Boss de terrain" })));

  /* Un donjon a plusieurs lignes (une par difficulte) qui partagent un groupe :
     c'est le groupe qui porte le nom. */
  const parGroupe = new Map();
  Object.values(entree.donjons || {}).forEach(donjon => {
    const cle = String(donjon.Dungeon_Group);
    if(!parGroupe.has(cle)){
      parGroupe.set(cle, { acteurs:new Set(), difficultes:[], zones:new Set(), type:donjon.Dungeon_Type });
    }
    const groupe = parGroupe.get(cle);
    enListe(donjon.Dungeon_Clear_Value).forEach(id => groupe.acteurs.add(id));
    groupe.zones.add(String(donjon.Dungeon_Zone));
    const difficulte = texte(donjon.Local_Sub_Name);
    if(difficulte && !groupe.difficultes.includes(difficulte)) groupe.difficultes.push(difficulte);
  });
  const libellesParZoneDeDonjon = new Map();
  parGroupe.forEach((groupe, cle) => {
    const ligne = (entree.groupesDonjon || {})[cle] || {};
    enListe(ligne.Dungeon_Core_Monster).forEach(id => groupe.acteurs.add(id));
    const nom = texte(ligne.Local_Main_Name);
    if(!nom) return;
    const sousNom = texte(ligne.Local_Main_Sub_Name);
    const brut = String(groupe.type || "").replace(/^.*::/, "");
    const libelle = "Donjon : " + nom + (sousNom ? " — " + sousNom : "")
      + " (" + (TYPES_DONJON[brut] || brut || "donjon") + ")"
      + (groupe.difficultes.length ? " — " + groupe.difficultes.join(", ") : "");
    groupe.acteurs.forEach(id => ajouter(id, { type:"donjon", libelle }));
    /* Par zone, un libelle par NOM de donjon : deux groupes de meme nom
       (les deux « Nid d'araignée profond ») n'en font qu'un. */
    groupe.zones.forEach(zone => {
      if(!libellesParZoneDeDonjon.has(zone)) libellesParZoneDeDonjon.set(zone, new Map());
      const parNom = libellesParZoneDeDonjon.get(zone);
      if(!parNom.has(nom)) parNom.set(nom, libelle);
    });
  });

  /* Une zone partagee par des donjons de noms differents (sept sur
     quarante-deux dans l'export du 22/09/2026) ne peut pas prendre le nom du
     premier : elle les nomme tous, trois au plus. */
  const libelleDeZoneDeDonjon = zone => {
    const parNom = libellesParZoneDeDonjon.get(zone);
    if(parNom.size === 1) return [...parNom.values()][0];
    const noms = [...parNom.keys()].sort((a, b) => a.localeCompare(b, "fr"));
    return "Donjons partageant la zone : " + noms.slice(0, 3).join(", ")
      + (noms.length > 3 ? " et " + (noms.length - 3) + " autres" : "");
  };

  (entree.apparitions || []).forEach(apparition => {
    let contexte;
    if(/^crosschallenge_/i.test(apparition.fichier)){
      contexte = { type:"cross", libelle:"Cross Challenge" };
    }else if(libellesParZoneDeDonjon.has(String(apparition.zone))){
      contexte = { type:"donjon", libelle:libelleDeZoneDeDonjon(String(apparition.zone)) };
    }else{
      const zone = (entree.zones || {})[apparition.zone];
      const nom = zone && texte(zone.Local_ZoneName);
      contexte = { type:"zone", libelle:"Zone : " + (nom || String(apparition.zone)) };
    }
    (apparition.acteurs || []).forEach(id => {
      /* Le boss d'un donjon a deja son etiquette exacte, tiree de la table du
         donjon : l'etiquette generique de sa zone n'y ajouterait que du bruit. */
      const dejaDansUnDonjon = contexte.type === "donjon"
        && (parActeur.get(String(id)) || []).some(present => present.type === "donjon");
      if(!dejaDansUnDonjon) ajouter(id, contexte);
    });
  });

  parActeur.forEach(trierContextes);
  return parActeur;
}

function copieDeVersion(version) {
  const copie = {
    rang:version.rang,
    acteurs:[...version.acteurs],
    contextes:version.contextes.map(contexte => Object.assign({}, contexte)),
    stats:version.stats
  };
  if(version.niveau !== undefined) copie.niveau = version.niveau;
  if(version.puissance) copie.puissance = version.puissance;
  return copie;
}

function prioriteDeVersion(version) {
  return version.contextes.length ? prioriteContexte(version.contextes[0]) : ORDRE_CONTEXTES_EXTRACTION.length;
}

/* Deux versions aux memes statistiques retenues n'en font qu'une : on garde
   l'union de leurs acteurs et de leurs contextes. Les paliers d'un boss ne se
   fusionnent jamais : leur niveau est leur identite. */
function fusionnerVersions(versions) {
  const sortie = [];
  const parCle = new Map();
  versions.forEach(version => {
    if(version.niveau !== undefined){
      sortie.push(copieDeVersion(version));
      return;
    }
    const cle = JSON.stringify([version.rang, version.stats, version.puissance || null]);
    const deja = parCle.get(cle);
    if(!deja){
      const copie = copieDeVersion(version);
      parCle.set(cle, copie);
      sortie.push(copie);
      return;
    }
    version.acteurs.forEach(id => { if(!deja.acteurs.includes(id)) deja.acteurs.push(id); });
    version.contextes.forEach(contexte => {
      if(!deja.contextes.some(present => present.libelle === contexte.libelle)){
        deja.contextes.push(Object.assign({}, contexte));
      }
    });
    trierContextes(deja.contextes);
  });
  return sortie.sort((a, b) =>
    (a.niveau === undefined ? -1 : a.niveau) - (b.niveau === undefined ? -1 : b.niveau)
    || prioriteDeVersion(a) - prioriteDeVersion(b)
    || a.acteurs[0].localeCompare(b.acteurs[0]));
}

/* Les strategies officielles des boss : local_boss_strategy_<code>_title_N
   et _desc_N, dans l'ordre de N. Le code se retrouve dans la cle du nom du
   monstre (mon_acumu -> Local_Mon_Name_Acumu_Demon_0001) ; une variante
   d'evenement (_event, _event_0001) rejoint son boss de base, apres lui. */
function strategiesParCode(textes, texte) {
  const parCode = new Map();
  Object.keys(textes || {}).forEach(cle => {
    const titreCle = /^local_boss_strategy_(.+)_title_(\d+)$/i.exec(cle);
    if(!titreCle) return;
    const titre = texte(cle);
    const description = texte(cle.replace(/_title_(\d+)$/i, "_desc_$1"));
    if(!titre || !description) return;
    const evenement = /_event(_\d+)?$/i.test(titreCle[1]);
    const code = titreCle[1].toLowerCase().replace(/^mon_/, "").replace(/_event(_\d+)?$/, "");
    if(!parCode.has(code)) parCode.set(code, []);
    parCode.get(code).push({ ordre:(evenement ? 100000 : 0) + Number(titreCle[2]), titre, texte:description });
  });
  return parCode;
}

/* Un code peut correspondre a plusieurs monstres : « baba_boss » couvre
   Durak (elite), Durak 「corrompu」 (boss) et Jorn le Costaud (elite). Seuls
   ceux du rang le plus eleve recoivent les strategies — celles de Durak
   parlent de corruption. Seule une vraie cle de nom compte : les pierres du
   combat d'Akumu portent une cle de strategie en guise de nom. */
function rattacherStrategies(monstres, clesParNom, parCode) {
  const parMonstre = new Map();
  parCode.forEach((strategies, code) => {
    const candidats = monstres.filter(monstre => [...clesParNom.get(monstre.nom)]
      .some(cle => cle.startsWith("local_mon_name_") && cle.includes(code)));
    const rangMax = Math.max(...candidats.map(monstre => ORDRE_RANGS.indexOf(monstre.rang)));
    candidats.filter(monstre => ORDRE_RANGS.indexOf(monstre.rang) === rangMax).forEach(monstre => {
      if(!parMonstre.has(monstre)) parMonstre.set(monstre, []);
      parMonstre.get(monstre).push(...strategies);
    });
  });
  parMonstre.forEach((trouvees, monstre) => { monstre.strategies = strategiesTriees(trouvees); });
}

function strategiesTriees(trouvees) {
  const vues = new Set();
  return trouvees.sort((a, b) => a.ordre - b.ordre)
    .filter(strategie => {
      const cle = strategie.titre + "|" + strategie.texte;
      if(vues.has(cle)) return false;
      vues.add(cle);
      return true;
    })
    .map(({ titre, texte }) => ({ titre, texte }));
}

function construireCatalogueMonstres(entree) {
  const texte = lecteurDeTextes(entree.textes);
  const strategies = strategiesParCode(entree.textes, texte);
  const clesParNom = new Map();
  const groupes = entree.groupes || {};
  const contextes = contextesParActeur(entree, texte);
  const paliersParBoss = new Map();
  Object.values(entree.paliersBoss || {}).forEach(palier => {
    const cle = String(palier.Boss_Tid);
    if(!paliersParBoss.has(cle)) paliersParBoss.set(cle, []);
    paliersParBoss.get(cle).push(palier);
  });

  const parNom = new Map();
  Object.entries(entree.monstres || {}).forEach(([id, acteur]) => {
    const nom = texte(acteur.Local_Key);
    if(!nom) return;
    const base = {
      rang:RANGS_EXTRACTION[acteur.grade] || "normal",
      acteurs:[String(id)],
      contextes:contextes.get(String(id)) || [],
      puissance:puissanceExtraction(acteur)
    };
    const versions = [];
    const paliers = paliersParBoss.get(String(id));
    if(paliers){
      paliers.forEach(palier => {
        const groupe = groupes[palier.Stat_Group];
        if(groupe){
          versions.push(Object.assign({}, base, {
            niveau:Number(palier.Stat_Level), stats:statsDuGroupeExtraction(groupe)
          }));
        }
      });
    }else if(acteur.StatGroupTid !== GROUPE_DE_TEST && groupes[acteur.StatGroupTid]){
      versions.push(Object.assign({}, base, { stats:statsDuGroupeExtraction(groupes[acteur.StatGroupTid]) }));
    }
    if(!versions.length) return;
    if(!parNom.has(nom)) parNom.set(nom, []);
    parNom.get(nom).push(...versions);
    if(!clesParNom.has(nom)) clesParNom.set(nom, new Set());
    clesParNom.get(nom).add(String(acteur.Local_Key).toLowerCase());
  });

  const monstres = [...parNom].map(([nom, versions]) => ({
    nom,
    rang:versions.reduce((meilleur, version) =>
      ORDRE_RANGS.indexOf(version.rang) > ORDRE_RANGS.indexOf(meilleur) ? version.rang : meilleur, "normal"),
    versions:fusionnerVersions(versions)
  })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  rattacherStrategies(monstres, clesParNom, strategies);

  return {
    version:1,
    genereLe:entree.genereLe || null,
    dateExport:entree.dateExport || null,
    monstres
  };
}

module.exports = { construireCatalogueMonstres, lecteurDeTextes, enListe };
