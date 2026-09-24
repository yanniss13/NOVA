"use strict";

/* Le lecteur des fichiers de /jarvis deposes dans le bucket PRIVE
   jarvis-prive : cache, delai, lecture partagee, journal et refus du
   validateur. Faux fetch, fausse horloge. Le bucket lui-meme (prive, sans
   politique) est garde par tests/jarvis-stockage.test.js. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const S = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-stockage.js"));
const M = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-monstres.js"));

const FICHIER = { version:1, contenu:["a"] };
const valider = brut => (brut && brut.version === 1 ? null : "format inconnu : " + (brut && brut.version));

function reponse(status, corps) {
  return { ok:status >= 200 && status < 300, status,
    json:async () => { if(corps instanceof Error) throw corps; return corps; } };
}

async function main() {
  let instant = 0;
  const appels = [];
  let suite = [reponse(200, FICHIER)];
  const lignes = [];
  const lire = S.creerLecteurStockageJarvis({
    url:"https://x.supabase.co/storage/v1/object/jarvis-prive/essai.json",
    cle:"service-role", nom:"essai", valider, horloge:() => instant,
    journaliser:ligne => lignes.push(ligne),
    fetch:async (url, init) => { appels.push({ url, init }); return suite.shift(); }
  });
  assert.equal(await lire(), FICHIER);
  assert.equal(appels[0].url, "https://x.supabase.co/storage/v1/object/jarvis-prive/essai.json");
  assert.equal(appels[0].init.headers.Authorization, "Bearer service-role");
  assert.equal(appels[0].init.headers.apikey, "service-role");
  assert.ok(appels[0].init.signal, "la lecture du stockage porte un délai");
  assert.deepEqual(lignes, [{ etape:"stockage-essai", ms:0, issue:"ok" }]);
  instant = 3_599_999;
  assert.equal(await lire(), FICHIER, "gardé une heure");
  assert.equal(appels.length, 1);
  instant = 3_600_001;
  suite = [reponse(404, {})];
  assert.equal(await lire(), null, "après l'heure, relu ; un 404 rend null");
  assert.equal(appels.length, 2);
  instant += 59_999;
  assert.equal(await lire(), null, "l'échec est gardé une minute");
  assert.equal(appels.length, 2);
  instant += 2;
  suite = [reponse(200, { version:2 })];
  assert.equal(await lire(), null, "refusé par le validateur");
  assert.equal(lignes[lignes.length - 1].issue, "format inconnu : 2",
    "le motif du refus est journalisé tel quel");
  instant += 60_001;
  suite = [reponse(200, new SyntaxError("JSON tronqué"))];
  assert.equal(await lire(), null, "JSON illisible refusé");

  const lireReseau = S.creerLecteurStockageJarvis({ url:"u", cle:"c", nom:"essai", valider,
    horloge:() => 0, journaliser:() => {}, fetch:async () => { throw new TypeError("réseau"); } });
  assert.equal(await lireReseau(), null, "stockage injoignable : null, pas d'exception");

  const lireAvecDelai = S.creerLecteurStockageJarvis({ url:"u", cle:"c", nom:"essai", valider,
    horloge:() => 0, journaliser:() => {},
    fetch:async () => { throw new DOMException("trop long", "TimeoutError"); } });
  assert.equal(await lireAvecDelai(), null, "délai dépassé : null, pas d'exception");

  /* Deux questions simultanees a froid : une seule lecture du fichier. */
  let lectures = 0;
  let libererLecture;
  const lectureEnCours = new Promise(resoudre => { libererLecture = resoudre; });
  const lirePartage = S.creerLecteurStockageJarvis({ url:"u", cle:"c", nom:"essai", valider,
    horloge:() => 0, journaliser:() => {},
    fetch:async () => { lectures += 1; await lectureEnCours; return reponse(200, FICHIER); } });
  const [premiere, seconde] = [lirePartage(), lirePartage()];
  libererLecture();
  assert.deepEqual([await premiere, await seconde], [FICHIER, FICHIER]);
  assert.equal(lectures, 1, "une lecture partagée, pas deux");

  const sansConfig = S.creerLecteurStockageJarvis({ url:"", cle:"", nom:"essai", valider,
    horloge:() => 0, journaliser:() => {},
    fetch:async () => { throw new Error("ne doit pas être appelé"); } });
  assert.equal(await sansConfig(), null);

  /* Le validateur des monstres, branche sur ce lecteur par index.ts. */
  assert.equal(M.validerCatalogueMonstres({ version:1, monstres:[] }), null);
  assert.match(M.validerCatalogueMonstres({ version:2, monstres:[] }), /format de monstres\.json inconnu : 2/);
  assert.match(M.validerCatalogueMonstres({ version:1, monstres:[{ nom:"Esprit", versions:[{}] }] }),
    /entrée mal formée dans monstres\.json : Esprit/);
  assert.match(M.validerCatalogueMonstres(null), /format de monstres\.json inconnu/);
  assert.equal(M.creerLecteurMonstresJarvis, undefined, "un seul lecteur, sans alias");

  console.log("OK discord-jarvis-stockage");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
