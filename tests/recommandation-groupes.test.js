"use strict";

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { bestBossSlots, recommendBossGroups } = hooks;

const maskAt = index => "0".repeat(index)+"1"+"0".repeat(167-index);
const profiles = Array.from({length:12}, (_, index) => ({
  id:"owner-"+index,
  pseudo:"Membre "+String(index).padStart(2,"0")
}));
const availabilityRows = profiles.map(profile => ({
  owner:profile.id,
  slots:maskAt(20)
}));
const roster = profiles.map((profile, index) => ({
  owner:profile.id,
  charId:"bug",
  potentialTier:10-index%6,
  builds:{Hache:{weapon:"arme-"+index}}
}));
const sessions = [{id:"boss-1"}];
const memberships = [
  {session_id:"boss-1", owner:"owner-11"},
  {session_id:"boss-1", owner:"owner-11"},
  {session_id:"boss-1", owner:"owner-11"}
];

const sourceSnapshot = JSON.stringify({profiles, availabilityRows, roster, sessions, memberships});
const result = plain(recommendBossGroups({
  slotIndex:20,
  profiles,
  availabilityRows,
  roster,
  sessions,
  memberships
}));

assert.equal(result.available, 11, "un membre ayant déjà 3 runs doit être écarté");
assert.equal(result.groups.length, 3);
assert.ok(result.groups.every(group => group.members.length <= 5));
assert.deepEqual(result.groups.map(group => group.members.length).sort(), [3,4,4]);
assert.ok(result.groups.every(group => group.elements.includes("DARK")));
assert.equal(JSON.stringify({profiles, availabilityRows, roster, sessions, memberships}), sourceSnapshot,
  "la recommandation ne doit muter aucune donnée source");

const reversed = plain(recommendBossGroups({
  slotIndex:20,
  profiles:[...profiles].reverse(),
  availabilityRows:[...availabilityRows].reverse(),
  roster:[...roster].reverse(),
  sessions,
  memberships
}));
assert.deepEqual(reversed, result, "la proposition doit rester déterministe");

const slots = plain(bestBossSlots([
  {owner:"a", slots:maskAt(50)},
  {owner:"b", slots:maskAt(20)},
  {owner:"c", slots:maskAt(20)}
]));
assert.deepEqual(slots.map(slot => [slot.index, slot.count]), [[20,2],[50,1]]);
assert.match(slots[0].label, /Lundi/);

console.log("PASS recommandation groupes : capacité, plafond de runs, stabilité et créneaux");
