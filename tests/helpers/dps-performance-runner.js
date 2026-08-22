"use strict";

const assert = require("node:assert/strict");
const { loadApp } = require("./load-app");

const { simulerDpsCompetences } = loadApp().hooks;
const stats = {
  atk:1000,
  def:500,
  maxHp:10000,
  remainingHp:10000,
  attaqueElementaire:0,
  critRate:0,
  critDamage:0,
  bonusCategorie:{ normal:0, "normal-skill":0, special:0, ultimate:0 },
  bonusElementaire:0,
  bonusGlobal:0
};
const cible = {
  def:5600,
  critResist:0,
  critDmgResist:0,
  resistanceElementaire:0,
  faiblesse:0
};
const competence = (gameId, categorie, recharge, pourcentage) => ({
  gameId,
  nom:gameId,
  categorie,
  recharge,
  composantes:[{ base:"atk", pourcentage }],
  pourcentage
});

const resultat = simulerDpsCompetences({
  stats,
  competences:[
    competence("auto-performance", "NORMAL", 0, 100),
    competence("normale-performance", "NORMAL_SKILL", 5, 300),
    competence("speciale-performance", "ACTIVE_THIRD", 10, 500),
    competence("ultime-performance", "ULTIMATE", 20, 1000)
  ],
  effets:[],
  cible,
  duree:60,
  animations:{ "auto-performance":2 }
});

assert.equal(resultat.duree, 60);
assert.ok(resultat.rotation.some(item =>
  item.type === "action" && item.gameId === "ultime-performance"
));
