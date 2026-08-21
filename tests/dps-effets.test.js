"use strict";

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { effetsDuBuild } = hooks;

assert.equal(typeof effetsDuBuild, "function", "le selecteur d'effets doit exister");

function source(id, regles){
  return {
    id,
    classification:"modelise",
    texteFr:id,
    regles:regles || []
  };
}

const setFiles = [
  "7ds-armures-ssr/Bas/Bas de l'araignée de l'ombre.webp",
  "7ds-armures-ssr/Bottes/Bottes de combat de l'araignée de l'ombre.webp",
  "7ds-armures-ssr/Ceinture/Ceinture de l'araignée de l'ombre.webp"
];
const linkedFile = "7ds-armures-ssr/Armure liee/Arrogance adéquate.webp";
const weaponFile = "7ds-armes/Baguette/Baguette de l'âme vorace.webp";

const potentials = {};
for(let tier = 1; tier <= 7; tier += 1){
  potentials[String(tier)] = source("potential:merlin:Wand:" + tier);
}

const catalogue = {
  heroes:{
    merlin:{
      Wand:{
        potentials,
        passives:{
          merlin_wand_passive:source("hero-passive:merlin_wand_passive", [
            { type:"bonus-stat", stat:"atk", valeur:2000 },
            { type:"bonus-critique", stat:"critRate", valeur:3000 },
            { type:"bonus-degats", cible:"element:thunder", valeur:5000 }
          ])
        }
      }
    }
  },
  skills:{
    merlin_wand_skill_q:Object.assign(
      source("skill:merlin_wand_skill_q"),
      { hero:"merlin", weaponType:"Wand" }
    ),
    merlin_book_skill_q:Object.assign(
      source("skill:merlin_book_skill_q"),
      { hero:"merlin", weaponType:"Book" }
    )
  },
  weapons:{
    "gluttonous-soul-wand":{
      levels:{
        1:source("weapon:gluttonous-soul-wand:1"),
        2:source("weapon:gluttonous-soul-wand:2"),
        3:source("weapon:gluttonous-soul-wand:3"),
        4:source("weapon:gluttonous-soul-wand:4")
      }
    }
  },
  gear:{
    armors:{},
    engravings:{
      133225002:{
        slug:"escanor-costume-134102304",
        passives:{
          EpEq_Escanor_C:{
            1:source("engraving:133225002:EpEq_Escanor_C:1"),
            2:source("engraving:133225002:EpEq_Escanor_C:2"),
            3:source("engraving:133225002:EpEq_Escanor_C:3")
          }
        }
      }
    }
  },
  sets:{
    equip_t5_darksand:{
      bonuses:{
        two:source("set:equip_t5_darksand:two"),
        four:source("set:equip_t5_darksand:four")
      }
    }
  }
};

const hero = {
  char:"merlin",
  potentiel:{ tier:6 },
  weapon:weaponFile,
  weaponConfig:{ version:1, overlimit:2 },
  armor:{
    Bas:setFiles[0],
    Bottes:setFiles[1],
    Ceinture:setFiles[2],
    "Armure liee":linkedFile
  },
  jewel:{}
};
const statsResult = {
  totals:[
    { stat:"B_Atk", value:1000 },
    { stat:"B_Def", value:500 },
    { stat:"B_MaxHp", value:10000 },
    { stat:"C_Critical_Rate", value:8000 },
    { stat:"C_Critical_Dam_Rate", value:15000 },
    { stat:"Normalskill_Damadd_Rate", value:100 },
    { stat:"Activethird_Damadd_Rate", value:200 },
    { stat:"Ultimateskill_Damadd_Rate", value:300 },
    { stat:"Thunder_Add", value:200 },
    { stat:"Thunder_Rate", value:5000 },
    { stat:"Thunder_Element_Rate", value:700 }
  ],
  facts:{
    passives:[{
      source:"weapon:passive", slot:"weapon", file:weaponFile,
      level:3, status:"valid"
    }, {
      source:"engraving:passive", slot:"Armure liee", file:linkedFile,
      level:3, status:"valid"
    }]
  }
};

const contexte = plain(effetsDuBuild({
  hero,
  dossierArme:"Baguette",
  catalogue,
  statsResult
}));

assert.deepStrictEqual(
  contexte.effets.filter(e => e.origine === "potential").map(e => e.tier),
  [1, 2, 3, 4, 5, 6]
);
assert.equal(
  contexte.effets.find(e => e.origine === "weapon").level,
  3,
  "outrepassement 2 donne le passif d'arme niveau 3"
);
assert.equal(
  contexte.effets.find(e => e.slot === "Armure liee").level,
  3
);
assert.ok(!contexte.effets.some(e => e.tier === 7));
assert.ok(contexte.effets.some(e => e.origine === "set" && e.threshold === "two"));
assert.ok(!contexte.effets.some(e => e.origine === "set" && e.threshold === "four"));
assert.ok(contexte.effets.some(e => e.origine === "skill" && e.id === "skill:merlin_wand_skill_q"));
assert.ok(!contexte.effets.some(e => e.id === "skill:merlin_book_skill_q"));

assert.equal(contexte.stats.atk, 1200, "le bonus personnel maximal applique +20 %");
assert.equal(contexte.stats.critRate, 10000, "le taux critique est plafonne avant la cible");
assert.equal(contexte.stats.attaqueElementaire, 300);
assert.equal(contexte.stats.bonusElementaire, 5700);
assert.deepStrictEqual(contexte.stats.bonusCategorie, {
  "normal-skill":100,
  special:200,
  ultimate:300
});
assert.equal(contexte.stats.remainingHp, contexte.stats.maxHp);
assert.ok(contexte.hypotheses.includes("passifs-personnels-actifs-au-maximum"));

const passifArmeManquant = plain(effetsDuBuild({
  hero,
  dossierArme:"Baguette",
  catalogue,
  statsResult:Object.assign({}, statsResult, {
    facts:{
      passives:statsResult.facts.passives.map(fact =>
        fact.source === "weapon:passive"
          ? Object.assign({}, fact, { level:null, status:"missing" })
          : fact
      )
    }
  })
}));
assert.ok(!passifArmeManquant.effets.some(effet => effet.origine === "weapon"));
assert.ok(passifArmeManquant.nonInclus.some(exclusion =>
  exclusion.id === "weapon:passive:weapon"
));

console.log("dps-effets.test.js OK");
