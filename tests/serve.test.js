"use strict";

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");

(async () => {
  const server = await serveRepo();
  try{
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/,
      "L'origine doit être locale et sur un port éphémère");

    // La racine sert index.html.
    const racine = await fetch(server.url + "/");
    assert.equal(racine.status, 200);
    assert.match(racine.headers.get("content-type"), /text\/html/);
    assert.match(await racine.text(), /<title>/i);

    // Un module doit être servi avec un type MIME exécutable, sinon le
    // navigateur refuse de l'évaluer.
    const script = await fetch(server.url + "/data.js");
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type"), /javascript/);

    // Un fichier absent répond 404 sans faire tomber le serveur.
    assert.equal((await fetch(server.url + "/inexistant.js")).status, 404);

    // Aucun test ne doit pouvoir lire hors du dépôt.
    const dehors = await fetch(server.url + "/../../../etc/passwd");
    assert.ok([403, 404].includes(dehors.status),
      "Une remontée de chemin doit être refusée");
  }finally{
    await server.close();
  }
  console.log("serve.test.js OK");
})().catch(error => { console.error(error); process.exit(1); });
