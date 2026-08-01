"use strict";

/* Serveur statique minimal pour les tests navigateur.
   Depuis le passage aux modules ES, `file://` ne convient plus : un
   `<script type="module">` y est bloqué par la politique d'origine
   (« Cross origin requests are only supported for protocol schemes: chrome,
   chrome-untrusted, data, http, https »). On sert donc le dépôt en http sur
   127.0.0.1, qui est un contexte sécurisé aux yeux des navigateurs.
   Aucune dépendance : `node:http` suffit. */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");

const TYPES = {
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".webp":"image/webp",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".svg":"image/svg+xml",
  ".ico":"image/x-icon"
};

async function serveRepo(){
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const target = path.resolve(ROOT, relative || "index.html");
    /* Un test ne doit jamais pouvoir lire en dehors du dépôt. */
    if(target !== ROOT && !target.startsWith(ROOT + path.sep)){
      response.writeHead(403);
      response.end();
      return;
    }
    fs.readFile(target, (error, body) => {
      if(error){
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        "content-type":
          TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
        /* Sans cela, deux tests successifs peuvent recevoir une version périmée
           du fichier qu'on vient de modifier. */
        "cache-control":"no-store"
      });
      response.end(body);
    });
  });

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    url:"http://127.0.0.1:" + port,
    close(){
      /* Playwright garde des connexions ouvertes : sans cette coupure
         explicite, `close()` ne rend jamais la main et le test se fige. */
      if(typeof server.closeAllConnections === "function"){
        server.closeAllConnections();
      }
      return new Promise(resolve => server.close(resolve));
    }
  };
}

module.exports = { serveRepo };
