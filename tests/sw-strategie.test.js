"use strict";

/* LA STRATEGIE DU SERVICE WORKER, EPROUVEE PLUTOT QUE LUE.

   Les fichiers applicatifs sont servis « cache d'abord, sans aller-retour
   reseau ». Cette optimisation ne se tient QUE parce que le nom du cache
   contient le SHA du commit deploye : une entree trouvee appartient forcement
   a la version courante.

   Dans le depot, `__BUILD_VERSION__` n'est pas remplace — c'est l'Action
   GitHub Pages qui l'injecte dans la copie publiee. Sur une copie servie
   directement, le nom du cache ne change donc JAMAIS, et « cache d'abord »
   devient « la premiere version pour toujours » : on modifie une feuille de
   style, on recharge, et le navigateur ressert l'ancienne. Le proprietaire
   l'a rencontre en previsualisant une correction de mise en page.

   Ce test verifie les deux moities de la regle : le cache d'abord quand la
   version est injectee, le reseau d'abord quand elle ne l'est pas. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
const ORIGINE = "https://exemple.test";

/* Charge sw.js dans une portee qui imite un ServiceWorkerGlobalScope, et
   rend de quoi lui poser une requete. `version` remplace le marqueur comme le
   ferait le deploiement ; la laisser nulle simule le depot tel quel. */
function chargerServiceWorker(version){
  const auditeurs = new Map();
  const journal = { reseau:[], cache:[] };
  /* Le cache contient deja la feuille : c'est le cas qui distingue les deux
     strategies, puisque cache d'abord s'arrete la et reseau d'abord non. */
  const entrees = new Map([["/css/charte.css", { corps:"cache" }]]);

  const cacheFactice = {
    match(requete){
      const chemin = new URL(requete.url || requete, ORIGINE).pathname;
      journal.cache.push(chemin);
      return Promise.resolve(entrees.get(chemin));
    },
    put:() => Promise.resolve(),
    add:() => Promise.resolve()
  };

  const scope = {
    URL, Promise, Set, Map, console,
    registration:{ scope:ORIGINE + "/" },
    location:{ origin:ORIGINE },
    clients:{ claim:() => Promise.resolve() },
    caches:{
      open:() => Promise.resolve(cacheFactice),
      keys:() => Promise.resolve([]),
      delete:() => Promise.resolve(true)
    },
    fetch(requete){
      journal.reseau.push(new URL(requete.url || requete, ORIGINE).pathname);
      return Promise.resolve({
        ok:true, redirected:false, corps:"reseau", clone:() => ({})
      });
    },
    Response:{ error:() => ({ corps:"erreur" }) },
    addEventListener:(nom, auditeur) => auditeurs.set(nom, auditeur)
  };
  scope.self = scope;

  const source = version
    ? SOURCE.replace('"__BUILD_VERSION__"', JSON.stringify(version))
    : SOURCE;
  vm.runInContext(source, vm.createContext(scope));

  return {
    journal,
    async demander(chemin){
      let promesse = null;
      auditeurs.get("fetch")({
        request:{ url:ORIGINE + chemin, method:"GET", mode:"cors", destination:"style" },
        respondWith:valeur => { promesse = valeur; },
        waitUntil:() => {}
      });
      assert.ok(promesse, "le service worker n'a pas repondu a " + chemin);
      return promesse;
    }
  };
}

(async () => {
  /* 1. Version injectee : le cache tranche seul, sans requete. */
  const deploye = chargerServiceWorker("a1b2c3d4e5f6");
  const depuisLeCache = await deploye.demander("/css/charte.css");
  assert.equal(depuisLeCache.corps, "cache",
    "une version deployee doit servir un fichier applicatif depuis son cache");
  assert.deepEqual(deploye.journal.reseau, [],
    "cache d'abord ne doit declencher aucune requete : 2,3 Mo par visite");

  /* 2. Marqueur non remplace : le reseau tranche, sinon la copie servie
        depuis le depot fige la premiere version pour toujours. */
  const local = chargerServiceWorker(null);
  const depuisLeReseau = await local.demander("/css/charte.css");
  assert.deepEqual(local.journal.reseau, ["/css/charte.css"],
    "sans SHA dans le nom du cache, un fichier applicatif doit repasser par "
      + "le reseau : autrement une modification locale reste invisible");
  assert.equal(depuisLeReseau.corps, "reseau",
    "c'est bien la reponse du reseau qui doit etre servie");

  console.log("sw-strategie.test.js OK (cache d'abord une fois deploye, "
    + "reseau d'abord sur une copie non versionnee)");
})().catch(erreur => {
  console.error(erreur);
  process.exitCode = 1;
});
