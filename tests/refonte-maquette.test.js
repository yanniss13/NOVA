"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PROTO = path.join(ROOT, "docs", "refonte-maquette");
const read = file => fs.readFileSync(path.join(PROTO, file), "utf8");

const html = read("index.html");
const data = read("donnees-demo.js");
const js = read("maquette.js");
const css = read("maquette.css") + read("responsive.css");
const readme = read("README.md");

["home", "dashboard", "teams", "boss", "roster", "tools", "admin"]
  .forEach(view => assert.match(html,
    new RegExp(`data-view=["']${view}["']`), `vue absente : ${view}`));

[
  "Mon suivi", "Créer une équipe", "Équipes partagées", "Disponibilités",
  "Groupes", "Rapports", "Mon roster", "Roster des membres", "Wiki",
  "Collection", "Calculateur", "Analyse", "Membres"
].forEach(label => assert.ok((html + data).includes(label),
  `fonction absente : ${label}`));

assert.doesNotMatch(html + js, /supabase|localStorage|serviceWorker/i);
assert.match(html, /nova-banniere-etendue\.png/);
assert.match(css, /@media\s*\(max-width:\s*767px\)/);
assert.match(html, /On prépare la suite,\s*<br>ensemble/);
assert.match(html, /data-action="create-account"/);
assert.match(html, /data-route="boss"/);
assert.match(html, /data-route="roster"/);
assert.match(html, /data-route="tools"/);
assert.match(css, /--abyss:\s*#050d14/i);
assert.match(css, /--gold-light:\s*#ddb45f/i);
assert.match(css, /min-height:\s*44px/);
assert.match(readme, /python -m http\.server/);
assert.match(readme, /aucune action n'est enregistrée/);
console.log("refonte-maquette.test.js OK");
