"use strict";

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  ROUTE_SESSION_ID_MAX_LENGTH,
  lireRoute,
  fragmentDeRoute,
  routeDeVue,
  urlAbsolueDeRoute
} = hooks;

assert.equal(typeof lireRoute, "function", "le lecteur de route doit exister");
assert.equal(typeof fragmentDeRoute, "function", "le sérialiseur doit exister");
assert.equal(typeof routeDeVue, "function", "les vues stables doivent devenir des routes");
assert.equal(typeof urlAbsolueDeRoute, "function", "les liens partagés doivent être absolus");

const stableViews = [
  "dashboard", "builder", "roster", "member-roster", "availability",
  "boss", "analyse", "wiki", "collection", "calculateur"
];

stableViews.forEach(view => {
  assert.deepEqual(plain(lireRoute("#" + view)), { type:"view", view });
  assert.equal(fragmentDeRoute(routeDeVue(view)), "#" + view);
});

/* Le Calculateur a une route NUE, jamais une route porteuse de contexte :
   un build ne se serialise pas dans le fragment. */
assert.equal(lireRoute("#calculateur/groupe/abc-123"), null);
assert.deepEqual(plain(lireRoute("#boss/groupe/run_2026-08-17")), {
  type:"group", view:"boss", sessionId:"run_2026-08-17"
});
assert.deepEqual(plain(lireRoute("#analyse/groupe/abc-123")), {
  type:"group", view:"analyse", sessionId:"abc-123"
});
assert.equal(ROUTE_SESSION_ID_MAX_LENGTH, 128);
assert.ok(lireRoute("#boss/groupe/" + "a".repeat(128)));
[
  "", "#", "#inconnue", "#boss/groupe/", "#boss/groupe/a/b",
  "#analyse/groupe/%2F", "#analyse/groupe/espace%20interdit",
  "#analyse/groupe/" + "a".repeat(129), "#analyse/groupe/%E0%A4%A"
].forEach(fragment => assert.equal(lireRoute(fragment), null, fragment));

const groupRoute = { type:"group", view:"boss", sessionId:"abc-123" };
assert.equal(fragmentDeRoute(groupRoute), "#boss/groupe/abc-123");
assert.equal(
  urlAbsolueDeRoute(groupRoute, "https://yanniss13.github.io/NOVA/index.html#wiki"),
  "https://yanniss13.github.io/NOVA/index.html#boss/groupe/abc-123"
);
assert.equal(urlAbsolueDeRoute(groupRoute, "pas une url"), null);

console.log("routage.test.js OK");
