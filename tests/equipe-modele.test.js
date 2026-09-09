"use strict";

/* Le modèle d'équipe : ce qui entre dans Supabase passe par `normalizeTeam`,
   quelle que soit la porte d'entrée. C'est le seul passage obligé, donc le
   seul endroit où nettoyer sert à quelque chose. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { normalizeTeam } = hooks;

assert.equal(typeof normalizeTeam, "function", "normalizeTeam doit exister");

/* Le contrat qui existait déjà : quatre héros, toujours, et un nom borné. */
{
  const vide = normalizeTeam({});
  assert.equal(vide.heroes.length, 4, "une équipe porte quatre emplacements");
  assert.equal(vide.name, "");
}

/* LA ROTATION D'ÉQUIPE.

   Elle voyage dans le blob `jsonb` de `public.teams.data`, donc aucune
   migration — mais c'est aussi pourquoi elle doit être nettoyée ICI : rien
   d'autre ne se tient entre le membre et la base. */
{
  const propre = normalizeTeam({
    heroes:[],
    rotation:["ban_cudgel3c_skill_e", 42, "PAS BON", null]
  });
  assert.deepEqual(
    Array.from(propre.rotation), ["ban_cudgel3c_skill_e"],
    "les saletés ne partent pas vers Supabase"
  );

  const absente = normalizeTeam({ heroes:[] });
  assert.ok(
    Array.isArray(absente.rotation) && absente.rotation.length === 0,
    "une équipe sans rotation en porte une vide, jamais undefined"
  );

  const invalide = normalizeTeam({ heroes:[], rotation:"ban_cudgel3c_skill_e" });
  assert.equal(
    invalide.rotation.length, 0,
    "une chaîne n'est pas une rotation"
  );

  /* Une combinaison survit intacte : c'est une étape valide, pas une saleté. */
  const combinee = normalizeTeam({
    heroes:[],
    rotation:["@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q"]
  });
  assert.equal(combinee.rotation.length, 1);
}

/* Les champs que le modèle ne connaît pas SURVIVENT : c'est ce qui a permis
   d'ajouter la rotation sans migrer le schéma, et ce qui permettra la
   prochaine. */
{
  const garde = normalizeTeam({ heroes:[], id:"abc", pseudo:"Yanni" });
  assert.equal(garde.id, "abc");
  assert.equal(garde.pseudo, "Yanni");
}

console.log("equipe-modele.test.js OK");
