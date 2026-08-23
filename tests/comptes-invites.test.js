"use strict";

/* La table de vérité du portier. Quatre situations, et une seule règle par
   ligne — c'est le genre de fonction où une condition inversée ne se voit
   qu'en production, chez la personne qu'elle enferme dehors. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  vueAutorisee, inviteHorsConfrerie, estAdministrateur, sessionCourante
} = hooks;

assert.equal(typeof vueAutorisee, "function", "le portier doit être exposé");
assert.equal(typeof inviteHorsConfrerie, "function");
assert.equal(typeof estAdministrateur, "function");
assert.equal(typeof sessionCourante, "object");

function poser(etat){
  sessionCourante.applicationEpoch = etat.epoch;
  sessionCourante.user = etat.user;
  sessionCourante.membre = etat.membre;
  sessionCourante.admin = etat.admin;
}

const PUBLIQUES = ["builder", "wiki", "collection", "calculateur"];
const CONFRERIE = ["dashboard", "roster", "analyse", "availability", "boss"];

/* ---- Hors ligne : aucune session appliquée, donc aucune porte fermée. ----

   C'est le contre-exemple qui compte. Sans Supabase — PWA sans réseau, script
   CDN absent — `applySession` n'est jamais appelée et tout retombe sur
   localStorage. Y fermer des portes enfermerait le membre hors de ses propres
   équipes, sans aucune fenêtre de connexion à lui proposer. */
poser({ epoch:0, user:null, membre:true, admin:false });
assert.equal(inviteHorsConfrerie(), false,
  "avant toute session, personne n'est un invité");
CONFRERIE.concat(PUBLIQUES).forEach(vue =>
  assert.equal(vueAutorisee(vue), true,
    "hors ligne, « " + vue + " » doit rester ouverte"));

/* ---- Visiteur sans compte : le comportement d'avant, inchangé. ---- */
poser({ epoch:1, user:null, membre:true, admin:false });
assert.equal(inviteHorsConfrerie(), false,
  "un visiteur sans compte n'est pas un invité : c'est autre chose");
PUBLIQUES.forEach(vue =>
  assert.equal(vueAutorisee(vue), true,
    "« " + vue + " » tient debout sans compte"));
CONFRERIE.concat(["member-roster"]).forEach(vue =>
  assert.equal(vueAutorisee(vue), false,
    "sans compte, « " + vue + " » n'a rien à montrer"));

/* ---- Invité : un compte, un roster, et rien de la confrérie. ---- */
poser({ epoch:1, user:{ id:"user-3" }, membre:false, admin:false });
assert.equal(inviteHorsConfrerie(), true);
assert.equal(estAdministrateur(), false);
PUBLIQUES.concat(["member-roster"]).forEach(vue =>
  assert.equal(vueAutorisee(vue), true,
    "un invité garde « " + vue + " » : c'est la raison de son compte"));
CONFRERIE.forEach(vue =>
  assert.equal(vueAutorisee(vue), false,
    "la RLS rendrait « " + vue + " » vide : mieux vaut ne pas l'ouvrir"));
assert.equal(vueAutorisee("admin"), false,
  "l'écran d'administration n'existe pas pour un invité");

/* ---- Membre : tout, sauf l'administration. ---- */
poser({ epoch:1, user:{ id:"user-1" }, membre:true, admin:false });
assert.equal(inviteHorsConfrerie(), false);
assert.equal(estAdministrateur(), false);
PUBLIQUES.concat(CONFRERIE, ["member-roster"]).forEach(vue =>
  assert.equal(vueAutorisee(vue), true,
    "un membre garde « " + vue + " »"));
assert.equal(vueAutorisee("admin"), false,
  "être membre ne suffit pas à administrer");

/* ---- Admin : l'écran en plus, et rien d'autre en plus. ---- */
poser({ epoch:1, user:{ id:"user-1" }, membre:true, admin:true });
assert.equal(estAdministrateur(), true);
assert.equal(vueAutorisee("admin"), true);

/* Un admin déconnecté n'est plus un admin : le drapeau seul ne suffit pas. */
poser({ epoch:1, user:null, membre:true, admin:true });
assert.equal(estAdministrateur(), false,
  "sans compte ouvert, le drapeau ne veut plus rien dire");

console.log("comptes-invites.test.js : OK");
