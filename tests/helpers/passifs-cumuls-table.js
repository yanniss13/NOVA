"use strict";

/* La table des passifs a cumuls, lue depuis data/passifs-cumuls.js.

   Elle existe pour que tests/degats-calcul.test.js rejoue les releves de
   Derieri contre la valeur REELLEMENT EXPEDIEE, et non contre une constante
   recopiee dans le test. Une valeur jumelle vivrait sa vie : la table pourrait
   deriver sans que le test s'en apercoive, ce qui est exactement le mode de
   panne que ce releve doit empecher. */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "data", "passifs-cumuls.js"), "utf8"
  ),
  bac,
  { filename:"passifs-cumuls.js" }
);

module.exports = bac.window.SEVEN_DS_PASSIFS_CUMULS;
