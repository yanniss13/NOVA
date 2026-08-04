"use strict";

const assert = require("node:assert");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { rosterSignature, normalizeRosterCharacter } = hooks;

assert.strictEqual(
  typeof rosterSignature,
  "function",
  "rosterSignature doit exister et être exposée par le chargeur de test"
);

/* Le bac à sable de test ne connaît que `meliodas` et `merlin` : tout autre
   identifiant ferait retourner null à normalizeRosterCharacter. */
function meliodas(tier, weapon, note=""){
  return normalizeRosterCharacter({
    owner:"membre-1",
    charId:"meliodas",
    potentialTier:tier,
    builds:{ Hache:{ weapon, armor:{}, jewel:{}, note } }
  });
}

function merlin(tier){
  return normalizeRosterCharacter({
    owner:"membre-1",
    charId:"merlin",
    potentialTier:tier,
    builds:{ Livre:{
      weapon:"7ds-armes/Livre/livre.webp", armor:{}, jewel:{}, note:""
    } }
  });
}

const hache = "7ds-armes/Hache/hache.webp";

// L'ordre de retour de Supabase ne doit jamais provoquer de repeint.
{
  assert.strictEqual(
    rosterSignature([meliodas(6, hache), merlin(4)]),
    rosterSignature([merlin(4), meliodas(6, hache)])
  );
}

// Un potentiel modifié depuis un autre appareil doit être vu.
{
  assert.notStrictEqual(
    rosterSignature([meliodas(6, hache)]),
    rosterSignature([meliodas(7, hache)])
  );
}

// Un build modifié à potentiel identique doit être vu.
{
  assert.notStrictEqual(
    rosterSignature([meliodas(6, hache, "")]),
    rosterSignature([meliodas(6, hache, "Ma préférée")])
  );
}

// Une fiche ajoutée ou retirée doit être vue.
{
  const seul = [meliodas(6, hache)];
  assert.notStrictEqual(
    rosterSignature(seul),
    rosterSignature(seul.concat([merlin(4)]))
  );
}

// Liste vide, null et undefined : même empreinte, aucune exception.
{
  assert.strictEqual(rosterSignature([]), rosterSignature(null));
  assert.strictEqual(rosterSignature([]), rosterSignature(undefined));
}

// Une entrée invalide est ignorée au lieu de faire échouer la comparaison.
{
  assert.strictEqual(
    rosterSignature([meliodas(6, hache)]),
    rosterSignature([meliodas(6, hache), { charId:"inconnu" }, null])
  );
}

console.log("PASS roster affichage instantane : empreinte");
