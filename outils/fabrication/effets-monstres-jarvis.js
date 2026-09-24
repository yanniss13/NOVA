"use strict";

/* Les effets que posent les monstres, pour /jarvis : logique PURE.

   LA CHAINE, verifiee sur l'export du 25/09/2026 :
     Mon_SkillTable : les competences s'appellent « <acteur>_... ».
     Un acteur sans competence a son numero emprunte celles de l'UNIQUE autre
       acteur de son groupe d'animations (ActorTid.ActorAniKeyGroup) : le
       boss de confrerie Akumu (50700109) utilise celles de 51300084.
     Mon_SkillBehaviorTable « <acteur>_... » -> BehaviorDetail_SetBuffTid[]
       (BuffTid, BuffTime en ms, ConType).
     MonsterActorTable[id].Spawning_Buff_List : les effets d'apparition.

   AUCUNE CIBLE. HitTarget vaut « Enemy » sur la « Reduction de l'attaque »
   d'Akumu, que le proprietaire a vue sur Akumu lui-meme : la table ne dit pas
   qui recoit un effet de monstre, et la nature buff/malus non plus. */

const { lecteurDeTextes } = require("./monstres-jarvis.js");
const { texteAfficheDuBuff, nettoyerMecanique } = require("./mecaniques-jarvis.js");

/* Seules les conditions que l'on sait dire. Une autre est ecartee : la
   montrer sans sa condition la ferait passer pour permanente. */
const CONDITIONS_EFFETS_MONSTRES = {
  "EPackCondType::None":null,
  "EPackCondType::Kill":"à la mort d'un joueur"
};
const CONDITION_APPARITION = "dès son apparition";

function prefixeDActeur(cle) {
  return String(cle).split("_")[0];
}

/* Acteur -> numero dont il utilise les competences, ou rien. */
function prefixesDesActeurs(monstres, competences) {
  const avecCompetences = new Set(Object.keys(competences || {}).map(prefixeDActeur));
  const parGroupe = new Map();
  Object.entries(monstres || {}).forEach(([id, acteur]) => {
    const groupe = acteur && acteur.ActorTid && acteur.ActorTid.ActorAniKeyGroup;
    if(!groupe || groupe === "None" || !avecCompetences.has(String(id))) return;
    if(!parGroupe.has(groupe)) parGroupe.set(groupe, []);
    parGroupe.get(groupe).push(String(id));
  });
  const prefixes = new Map();
  Object.entries(monstres || {}).forEach(([id, acteur]) => {
    if(avecCompetences.has(String(id))){
      prefixes.set(String(id), String(id));
      return;
    }
    const groupe = acteur && acteur.ActorTid && acteur.ActorTid.ActorAniKeyGroup;
    const candidats = parGroupe.get(groupe) || [];
    if(candidats.length === 1) prefixes.set(String(id), candidats[0]);
  });
  return prefixes;
}

function effetsParActeur(entree) {
  const lireBrut = lecteurDeTextes(entree.textes);
  /* Une traduction absente rend parfois la cle elle-meme : pas un texte. */
  const lire = cle => {
    const texte = lireBrut(cle);
    return texte && texte.toLowerCase() === String(cle).toLowerCase() ? null : texte;
  };
  const buffs = entree.buffs || {};

  function effet(buffTid, dureeMs, condition) {
    const brut = buffs[buffTid];
    const nom = brut && nettoyerMecanique(lire(brut.Local_Key));
    if(!nom) return null;
    const sortie = { nom };
    const texte = texteAfficheDuBuff(brut, lire);
    if(texte) sortie.texte = texte;
    if(Number(dureeMs) > 0) sortie.dureeS = Number(dureeMs) / 1000;
    const cumul = Number(brut.StackType && brut.StackType.MaxStack) || 0;
    if(cumul > 1) sortie.cumulMax = cumul;
    if(condition) sortie.condition = condition;
    return sortie;
  }

  const posesParPrefixe = new Map();
  Object.keys(entree.comportements || {}).sort().forEach(cle => {
    const prefixe = prefixeDActeur(cle);
    (entree.comportements[cle].BehaviorDetail_SetBuffTid || []).forEach(pose => {
      if(!(pose.ConType in CONDITIONS_EFFETS_MONSTRES)) return;
      if(Number(pose.BuffCnt) < 0) return;
      const trouve = effet(String(pose.BuffTid), pose.BuffTime, CONDITIONS_EFFETS_MONSTRES[pose.ConType]);
      if(!trouve) return;
      if(!posesParPrefixe.has(prefixe)) posesParPrefixe.set(prefixe, []);
      posesParPrefixe.get(prefixe).push(trouve);
    });
  });

  const sortie = new Map();
  const prefixes = prefixesDesActeurs(entree.monstres, entree.competences);
  Object.entries(entree.monstres || {}).forEach(([id, acteur]) => {
    const apparition = [].concat(acteur && acteur.Spawning_Buff_List || [])
      .map(buffTid => effet(String(buffTid), 0, CONDITION_APPARITION));
    const effets = sansDoublons(apparition.concat(posesParPrefixe.get(prefixes.get(String(id))) || []));
    if(effets.length) sortie.set(String(id), effets);
  });
  return sortie;
}

function sansDoublons(effets) {
  const vus = new Set();
  return effets.filter(effet => {
    if(!effet) return false;
    const cle = JSON.stringify(effet);
    if(vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/* Un monstre recoit l'union des effets des acteurs de toutes ses versions. */
function rattacherEffets(monstres, parActeur) {
  monstres.forEach(monstre => {
    const effets = sansDoublons(monstre.versions
      .flatMap(version => version.acteurs)
      .flatMap(id => parActeur.get(String(id)) || []));
    if(effets.length) monstre.effets = effets;
  });
}

module.exports = { effetsParActeur, rattacherEffets };
