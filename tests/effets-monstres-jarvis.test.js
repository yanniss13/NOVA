"use strict";

/* Les effets poses par les monstres, sur un mini-export ecrit ici. Formes de
   l'export reel du 25/09/2026 : le boss de confrerie Akumu (50700109) n'a
   aucune competence a son numero ; il partage son groupe d'animations avec
   l'acteur de travail 51300084, dont les comportements posent les effets. */

const assert = require("node:assert/strict");
const path = require("node:path");

const { effetsParActeur, rattacherEffets } = require(path.resolve(
  __dirname, "..", "outils", "fabrication", "effets-monstres-jarvis.js"
));

function acteur(groupe, apparition) {
  return { ActorTid:{ ActorAniKeyGroup:groupe }, Spawning_Buff_List:apparition || [] };
}
function pose(buff, duree, autres) {
  return Object.assign({ BuffTid:buff, BuffTime:duree, ConType:"EPackCondType::None", BuffCnt:1 }, autres || {});
}
function buff(cle, description, remplacement, cumul) {
  return {
    Local_Key:cle, Local_Desc:description, Local_Replace:remplacement ? [remplacement] : [],
    StackType:{ MaxStack:cumul || 1 }
  };
}

const ENTREE_EFFETS_TEST = {
  monstres:{
    "50700109":acteur("mon_acumu_demon_0001", ["305033023", "304100002"]),
    "51300084":acteur("mon_acumu_demon_0001"),
    /* Deux acteurs avec competences dans le meme groupe : le troisieme, qui
       n'en a pas, ne peut pas choisir. */
    "60000001":acteur("groupe_partage"),
    "60000002":acteur("groupe_partage"),
    "60000003":acteur("groupe_partage"),
    "70000001":acteur("None")
  },
  competences:{
    "51300084_normalatk_1":{}, "51300084_skill_1_start":{},
    "60000002_normalatk_1":{}, "60000003_normalatk_1":{}
  },
  comportements:{
    "51300084_normalatk_1_h1":{ BehaviorDetail_SetBuffTid:[
      pose("309031005", 1500),
      pose("305033011", 30000),
      pose("305033014", 600000, { ConType:"EPackCondType::Kill", BuffCnt:5 })
    ] },
    /* Le meme effet pose par une autre attaque ne se repete pas. */
    "51300084_normalatk_1_h2":{ BehaviorDetail_SetBuffTid:[pose("305033011", 30000)] },
    /* Une condition que ce module ne sait pas dire : l'effet est ecarte
       plutot que presente comme inconditionnel. */
    "51300084_skill_1_start_h1":{ BehaviorDetail_SetBuffTid:[
      pose("305033012", 30000, { ConType:"EPackCondType::Inconnue" }),
      /* Un nombre negatif retire des cumuls : ce n'est pas une pose. */
      pose("305033012", 30000, { BuffCnt:-1 }),
      pose("305033013", 0)
    ] },
    /* Un comportement sans prefixe d'acteur n'appartient a personne. */
    "mon_acumu_demon_atkback_debuff":{ BehaviorDetail_SetBuffTid:[pose("305033013", 5000)] },
    "60000002_normalatk_1_h1":{ BehaviorDetail_SetBuffTid:[pose("305033011", 10000)] },
    "60000003_normalatk_1_h1":{ BehaviorDetail_SetBuffTid:[pose("305033013", 10000)] }
  },
  buffs:{
    "309031005":buff("None", "None"),
    "305033011":buff("Local_DeBuff_AtkDown_Name", "local_debuff_atkdown_desc", "{0}:{10%}"),
    "305033014":buff("Local_Buff_I_AtkAdd_Rate_Name", "local_buff_i_atkadd_rate_desc", "{0}:{20%}", 5),
    "305033012":buff("Local_DeBuff_DefDown_Name", "local_debuff_defdown_desc", "{0}:{15%}"),
    "305033013":buff("Local_DeBuff_AddDam_Hit_Name", "local_debuff_adddam_hit_desc", "{0}:{50%}"),
    "305033023":buff("Local_Buff_Shield_Name", "None"),
    /* Traduction absente : le jeu rend la cle elle-meme, ce n'est pas un nom. */
    "304100002":buff("local_buff_systeme_name", "None")
  },
  textes:{
    local_debuff_atkdown_name:"Réduction de l'attaque",
    local_debuff_atkdown_desc:"Attaque [#1A7331]-{0}[-]",
    local_buff_i_atkadd_rate_name:"Augmentation de l'attaque",
    local_buff_i_atkadd_rate_desc:"Attaque [#1A7331]+{0}[-]",
    local_debuff_defdown_name:"Réduction de la défense",
    local_debuff_defdown_desc:"Réduit la défense de [#1A7331]{0}[-]",
    local_debuff_adddam_hit_name:"Augmentation des dégâts subis",
    local_debuff_adddam_hit_desc:"Dégâts subis [#1A7331]+{0}[-]",
    local_buff_shield_name:"Bouclier",
    local_buff_systeme_name:"local_buff_systeme_name"
  }
};

const AKUMU = [
  { nom:"Bouclier", condition:"dès son apparition" },
  { nom:"Réduction de l'attaque", texte:"Attaque -10 %", dureeS:30 },
  { nom:"Augmentation de l'attaque", texte:"Attaque +20 %", dureeS:600, cumulMax:5,
    condition:"à la mort d'un joueur" },
  { nom:"Augmentation des dégâts subis", texte:"Dégâts subis +50 %" }
];

const parActeur = effetsParActeur(ENTREE_EFFETS_TEST);

/* Le boss de confrerie emprunte les competences de son groupe d'animations,
   ajoute ses effets d'apparition, et ne recoit aucune cible : la table ne
   dit pas qui recoit l'effet. */
assert.deepEqual(parActeur.get("50700109"), AKUMU);
assert.deepEqual(parActeur.get("51300084"), AKUMU.slice(1));
assert.ok(AKUMU.every(effet => !("cible" in effet)));

/* Groupe ambigu : rien plutot qu'un melange ; chacun garde les siens. */
assert.equal(parActeur.has("60000001"), false);
assert.deepEqual(parActeur.get("60000002"),
  [{ nom:"Réduction de l'attaque", texte:"Attaque -10 %", dureeS:10 }]);
assert.equal(parActeur.has("70000001"), false);

/* Rattachement au catalogue : l'union des acteurs de toutes les versions,
   sans doublon ; un monstre sans effet ne recoit pas de champ vide. */
const monstres = [
  { nom:"Akumu, bête démoniaque", versions:[{ acteurs:["51300084"] }, { acteurs:["50700109"] }] },
  { nom:"Lapin", versions:[{ acteurs:["70000001"] }] }
];
rattacherEffets(monstres, parActeur);
assert.deepEqual(monstres[0].effets, [AKUMU[1], AKUMU[2], AKUMU[3], AKUMU[0]]);
assert.equal("effets" in monstres[1], false);

module.exports = { ENTREE_EFFETS_TEST };

if(require.main === module) console.log("OK effets-monstres-jarvis");
