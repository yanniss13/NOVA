"use strict";

/* /jarvis sans reseau : un faux Gemini deroule des scenarios ecrits a
   l'avance, et l'on verifie ce que la boucle lui envoie autant que ce
   qu'elle en tire. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PARTAGE = path.join(ROOT, "supabase", "functions", "_shared");
const Q = require(path.join(PARTAGE, "discord-jarvis.js"));
const { outils: outilsFactices } = require("./discord-jarvis-outils.test.js");

function texte(t) { return { candidates:[{ content:{ role:"model", parts:[{ text:t }] } }] }; }
function appel(name, args, id) {
  const functionCall = { name, args };
  if(id) functionCall.id = id;
  return { candidates:[{ content:{ role:"model", parts:[{ functionCall }] } }],
    usageMetadata:{ totalTokenCount:42 } };
}
function fauxGemini(reponses) {
  const corps = [];
  const appeler = async requete => {
    corps.push(JSON.parse(JSON.stringify(requete)));
    const suivante = reponses.shift();
    if(suivante instanceof Error) throw suivante;
    if(!suivante) throw new Error("Gemini appele une fois de trop");
    return suivante;
  };
  return { corps, appeler };
}
function fauxOutils() {
  const executes = [];
  return {
    executes,
    declarations:[{ name:"fiche_personnage", description:"x" }],
    async executer(nom, args) {
      executes.push([nom, args]);
      return { donnees:{ personnage:"Meliodas" }, source:"fiche Meliodas" };
    }
  };
}
const MAINTENANT = () => new Date("2026-09-24T19:05:00Z");

async function main() {
  /* La commande */
  const def = Q.jarvisCommandDefinition();
  assert.equal(def.name, "jarvis");
  assert.match(def.name, /^[-_\p{Ll}\p{N}]{1,32}$/u,
    "Discord refuse majuscules et points : /J.A.R.V.I.S. est impossible");
  assert.match(def.description, /J\.A\.R\.V\.I\.S\./);
  assert.equal(def.type, 1);
  assert.ok(def.description.length <= 100 && /Gemini/.test(def.description),
    "la description previent que la question part chez Google");
  assert.deepEqual(def.options.map(o => [o.name, o.type, Boolean(o.required)]),
    [["texte", 3, true], ["prive", 5, false]]);
  assert.equal(def.options[0].max_length, 500);
  def.options.forEach(o => assert.ok(o.description.length <= 100));

  /* Options, reponse differee, portee du delai */
  const interaction = { guild_id:"g", member:{ user:{ id:"u1" } },
    data:{ name:"jarvis", options:[{ name:"texte", value:"  Qui a Escanor ?  " }, { name:"prive", value:true }] } };
  assert.deepEqual(Q.lireOptionsJarvis(interaction), { texte:"Qui a Escanor ?", prive:true });
  assert.deepEqual(Q.reponseDiffereeJarvis(interaction), { type:5, data:{ flags:64 } });
  assert.deepEqual(Q.reponseDiffereeJarvis({ data:{ options:[{ name:"texte", value:"x" }] } }), { type:5 });
  assert.equal(Q.porteeJarvis(interaction, "g"), "g:jarvis:u1");
  assert.equal(Q.porteeJarvis({ user:{ id:"u2" } }, "g"), "g:jarvis:u2");
  assert.equal(Q.porteeJarvis({}, "g"), "");

  /* Validation */
  assert.equal(Q.validerQuestion("Salut"), "");
  assert.match(Q.validerQuestion(""), /Écris ta question/);
  assert.match(Q.validerQuestion("x".repeat(501)), /500 caractères/);
  assert.equal(Q.validerQuestion("x".repeat(500)), "");

  /* Contexte temporel en heure de Paris */
  assert.match(Q.contexteTemporel(MAINTENANT()), /jeudi 24 septembre 2026.*21:05.*heure de Paris/);

  /* 1. Reponse directe, sans outil */
  const direct = fauxGemini([texte("Bonjour !")]);
  const r1 = await Q.repondreQuestion({ question:"Salut", outils:fauxOutils(),
    appelerGemini:direct.appeler, maintenant:MAINTENANT });
  assert.equal(r1.texte, "Bonjour !");
  assert.deepEqual(r1.sources, []);
  assert.equal(r1.tours, 1);
  const premier = direct.corps[0];
  assert.equal(premier.systemInstruction.parts[0].text, Q.CONSIGNE_JARVIS);
  assert.match(premier.contents[0].parts[0].text, /heure de Paris[\s\S]*Question : Salut$/);
  assert.equal(premier.toolConfig.functionCallingConfig.mode, "AUTO");
  assert.equal(premier.generationConfig.temperature, 0.3);
  /* Sur un modele qui reflechit, les tokens de pensee comptent dans ce plafond :
     trop bas, la reponse sortirait vide. Le texte reste tronque a 2000 caracteres. */
  assert.equal(premier.generationConfig.maxOutputTokens, 8192);
  assert.deepEqual(premier.tools[0].functionDeclarations.map(d => d.name), ["fiche_personnage"]);

  /* 2. Un outil, puis la reponse : le contenu du modele est renvoye TEL QUEL
        (il peut porter une signature de pensee), et l'id de l'appel suit. */
  const avecOutil = fauxGemini([appel("fiche_personnage", { nom:"mel" }, "c1"), texte("Meliodas…")]);
  const outils2 = fauxOutils();
  const r2 = await Q.repondreQuestion({ question:"Mel ?", outils:outils2,
    appelerGemini:avecOutil.appeler, maintenant:MAINTENANT });
  assert.equal(r2.texte, "Meliodas…");
  assert.deepEqual(outils2.executes, [["fiche_personnage", { nom:"mel" }]]);
  assert.deepEqual(r2.sources, ["fiche Meliodas"]);
  assert.deepEqual(r2.outils, ["fiche_personnage"]);
  assert.deepEqual(r2.usage, { totalTokenCount:42 });
  const second = avecOutil.corps[1].contents;
  assert.deepEqual(second[1], { role:"model", parts:[{ functionCall:{ name:"fiche_personnage", args:{ nom:"mel" }, id:"c1" } }] });
  assert.deepEqual(second[2], { role:"user", parts:[{ functionResponse:{
    name:"fiche_personnage", id:"c1", response:{ resultat:{ personnage:"Meliodas" } } } }] });

  /* 3. Deux outils dans le meme tour : une seule source si elle se repete. */
  const double = fauxGemini([
    { candidates:[{ content:{ role:"model", parts:[
      { functionCall:{ name:"fiche_personnage", args:{ nom:"a" } } },
      { functionCall:{ name:"fiche_personnage", args:{ nom:"b" } } }
    ] } }] },
    texte("Les deux.")
  ]);
  const r3 = await Q.repondreQuestion({ question:"?", outils:fauxOutils(),
    appelerGemini:double.appeler, maintenant:MAINTENANT });
  assert.equal(double.corps[1].contents[2].parts.length, 2);
  assert.deepEqual(r3.sources, ["fiche Meliodas"]);

  /* 4. Plafond de 5 allers-retours : le 5e tour interdit les outils. */
  const bavard = fauxGemini([
    appel("fiche_personnage", {}), appel("fiche_personnage", {}), appel("fiche_personnage", {}),
    appel("fiche_personnage", {}), texte("Voilà ce que j'ai.")
  ]);
  const r4 = await Q.repondreQuestion({ question:"?", outils:fauxOutils(),
    appelerGemini:bavard.appeler, maintenant:MAINTENANT });
  assert.equal(r4.tours, 5);
  assert.equal(bavard.corps[4].toolConfig.functionCallingConfig.mode, "NONE");
  /* Le dernier tour le dit aussi en toutes lettres : le mode NONE seul n'a
     pas suffi a gemini-3-flash-preview le 24/09/2026. */
  assert.match(bavard.corps[4].systemInstruction.parts[0].text, /Dernier tour/);
  assert.doesNotMatch(bavard.corps[0].systemInstruction.parts[0].text, /Dernier tour/);

  /* Sequence reelle du 24/09/2026 : au 5e tour, malgre NONE, le modele rend
     un appel d'outil (functionCall+thoughtSignature, fin STOP) et aucun
     texte. Un appel de rattrapage part alors SANS aucun outil declare. */
  const ignoreNone = { candidates:[{ finishReason:"STOP", content:{ role:"model", parts:[
    { functionCall:{ name:"chercher_effets", args:{ texte:"défense" } }, thoughtSignature:"sig" }
  ] } }] };
  const rattrape = fauxGemini([
    appel("fiche_personnage", {}), appel("fiche_personnage", {}), appel("fiche_personnage", {}),
    appel("fiche_personnage", {}), ignoreNone, texte("Trois héros, d'après les fichiers.")
  ]);
  const journalRattrape = [];
  const r4b = await Q.repondreQuestion({ question:"?", outils:fauxOutils(), journal:journalRattrape,
    appelerGemini:rattrape.appeler, maintenant:MAINTENANT, horloge:() => 0 });
  assert.equal(r4b.texte, "Trois héros, d'après les fichiers.");
  assert.equal(rattrape.corps.length, 6);
  assert.equal(rattrape.corps[5].tools, undefined, "le rattrapage ne déclare aucun outil");
  assert.equal(rattrape.corps[5].toolConfig, undefined);
  assert.match(rattrape.corps[5].systemInstruction.parts[0].text, /Dernier tour/);
  assert.equal(rattrape.corps[5].contents.length, rattrape.corps[4].contents.length,
    "l'appel d'outil ignoré n'est pas renvoyé : il n'aurait pas de réponse");
  assert.deepEqual(journalRattrape.slice(-2).map(ligne => [ligne.tour, ligne.issue]),
    [[5, "vide"], ["rattrapage", "texte"]]);

  const tetu = fauxGemini([1, 2, 3, 4, 5, 6].map(() => appel("fiche_personnage", {})));
  await assert.rejects(Q.repondreQuestion({ question:"?", outils:fauxOutils(),
    appelerGemini:tetu.appeler, maintenant:MAINTENANT }), erreur => erreur.code === "bloque");
  /* Un rattrapage refusé par Google ne fait pas pire que le message actuel. */
  const rattrapageRefuse = fauxGemini([1, 2, 3, 4, 5].map(() => appel("fiche_personnage", {}))
    .concat([Object.assign(new Error("400"), { code:"autre" })]));
  await assert.rejects(Q.repondreQuestion({ question:"?", outils:fauxOutils(),
    appelerGemini:rattrapageRefuse.appeler, maintenant:MAINTENANT }), erreur => erreur.code === "bloque");

  /* 5. Reponse vide ou bloquee, et pensees ignorees */
  const bloque = fauxGemini([{ candidates:[{ finishReason:"SAFETY" }] }]);
  await assert.rejects(Q.repondreQuestion({ question:"?", outils:fauxOutils(),
    appelerGemini:bloque.appeler, maintenant:MAINTENANT }), erreur => erreur.code === "bloque");
  const pensee = fauxGemini([{ candidates:[{ content:{ parts:[
    { text:"je réfléchis", thought:true }, { text:"Réponse." } ] } }] }]);
  assert.equal((await Q.repondreQuestion({ question:"?", outils:fauxOutils(),
    appelerGemini:pensee.appeler, maintenant:MAINTENANT })).texte, "Réponse.");

  /* 6. Les erreurs de Gemini remontent avec leur code */
  const quota = fauxGemini([Q.erreurJarvis("quota")]);
  await assert.rejects(Q.repondreQuestion({ question:"?", outils:fauxOutils(),
    appelerGemini:quota.appeler, maintenant:MAINTENANT }), erreur => erreur.code === "quota");

  /* 7. Delai total : pas de nouvel appel une fois les 90 s depassees */
  let instant = 0;
  const lent = fauxGemini([appel("fiche_personnage", {}), texte("trop tard")]);
  await assert.rejects(Q.repondreQuestion({ question:"?", outils:{ ...fauxOutils(),
    async executer() { instant += 91_000; return { donnees:{}, source:null }; } },
    appelerGemini:lent.appeler, maintenant:MAINTENANT, horloge:() => instant }),
    erreur => erreur.code === "delai");
  assert.equal(lent.corps.length, 1);

  /* 7 bis. Le journal des etapes : la duree de chaque appel a Gemini et de
     chaque outil, meme quand la question echoue. Sans lui, un « delai
     depasse » ne dit pas QUELLE attente a bloque. */
  let horlogeJournal = 0;
  const journal = [];
  const lentOutil = fauxGemini([appel("fiche_personnage", {}), texte("fini")]);
  await Q.repondreQuestion({ question:"?", maintenant:MAINTENANT, journal,
    horloge:() => horlogeJournal,
    appelerGemini:async corps => { horlogeJournal += 1200; return lentOutil.appeler(corps); },
    outils:{ ...fauxOutils(), async executer() {
      horlogeJournal += 45_000; return { donnees:{ erreur:"lecture impossible" }, source:null }; } } });
  assert.deepEqual(journal, [
    { etape:"gemini", tour:1, ms:1200, issue:"outils" },
    { etape:"outil", nom:"fiche_personnage", ms:45_000, issue:"erreur" },
    { etape:"gemini", tour:2, ms:1200, issue:"texte" }
  ]);
  const journalEchec = [];
  await assert.rejects(Q.repondreQuestion({ question:"?", maintenant:MAINTENANT, journal:journalEchec,
    horloge:() => 0, outils:fauxOutils(),
    appelerGemini:async () => { throw Q.erreurJarvis("delai"); } }), erreur => erreur.code === "delai");
  assert.deepEqual(journalEchec, [{ etape:"gemini", tour:1, ms:0, issue:"delai" }]);
  /* Une reponse sans texte : le journal dit POURQUOI (raison de fin donnee par
     Google, nature des morceaux recus), sinon « je ne peux pas repondre » reste
     une boite noire. */
  const journalVide = [];
  const vide = fauxGemini([{ candidates:[{ finishReason:"STOP", content:{ role:"model",
    parts:[{ thoughtSignature:"sig" }, { text:"pensée", thought:true }, { text:"" }] } }] }]);
  await assert.rejects(Q.repondreQuestion({ question:"?", maintenant:MAINTENANT, journal:journalVide,
    horloge:() => 0, outils:fauxOutils(), appelerGemini:vide.appeler }), erreur => erreur.code === "bloque");
  assert.deepEqual(journalVide, [{ etape:"gemini", tour:1, ms:0, issue:"vide",
    fin:"STOP", parties:["thoughtSignature", "pensee", "texte(0)"] }]);

  /* 7 ter. La question citee ne peut pas casser la mise en forme : un ```
     ou un || tape par le membre ouvrait un bloc de code ou un spoiler qui
     avalait la reponse. */
  const citee = Q.messageJarvis("```js alert ||spoil||", { texte:"ok", sources:[] });
  assert.match(citee, /^> \*\*Question :\*\* \\`\\`\\`js alert \\\|\\\|spoil\\\|\\\|\n/);

  /* 8. Le message publie */
  const message = Q.messageJarvis("Qui a\nEscanor ? @everyone",
    { texte:"**Kiro** l'a en P9.", sources:["possesseurs de Escanor", "fiche Escanor"] });
  assert.equal(message,
    "> **Question :** Qui a Escanor ? @everyone\n**Kiro** l'a en P9.\n"
    + "-# Sources : possesseurs de Escanor · fiche Escanor · réponse générée par IA");
  const sansSource = Q.messageJarvis("?", { texte:"Bonjour.", sources:[] });
  assert.match(sansSource, /-# Aucune donnée de NOVA consultée · réponse générée par IA$/);
  const long = Q.messageJarvis("x".repeat(400), { texte:"é".repeat(5000), sources:["s"] });
  assert.ok(Array.from(long).length <= 2000, "limite Discord");
  assert.match(long, /… \(réponse tronquée\)\n-# Sources : s/);
  assert.match(long, /^> \*\*Question :\*\* x{199}…\n/, "question citee sur 200 caracteres au plus");

  /* 8 bis. Les sources viennent d'arguments choisis par Gemini : bornees,
     sur une ligne, sans markdown actif. Sinon le message depasse la limite de
     Discord (400, donc erreur generique) ou affiche un lien dans une ligne
     presentee comme ecrite par le code. */
  const deborde = Q.messageJarvis("?", { texte:"Réponse.", sources:[
    "recherche « " + "x".repeat(3000) + " »",
    "roster de Ki\nro [clic](https://exemple.invalid) *gras*",
    ...Array.from({ length:40 }, (_, i) => "fiche Héros numéro " + i)
  ] });
  assert.ok(Array.from(deborde).length <= 2000, "limite Discord malgre les sources");
  const piedDeborde = deborde.slice(deborde.lastIndexOf("\n-# ") + 1);
  assert.doesNotMatch(piedDeborde, /\n/, "le pied tient sur une ligne");
  assert.ok(Array.from(piedDeborde).length <= 400, "pied borne");
  assert.doesNotMatch(piedDeborde, /[^\\]\[clic\]\(/, "lien neutralise");
  assert.match(piedDeborde, /roster de Ki ro \\\[clic\\\]/);
  assert.match(piedDeborde, /…/, "les sources en trop sont elidees");
  assert.match(deborde, /\nRéponse\.\n/, "la reponse n'est pas sacrifiee aux sources");
  assert.match(Q.messageJarvis("?", { texte:"ok", sources:["scores de boss (semaine)"] }),
    /Sources : scores de boss \(semaine\) ·/, "les parentheses ordinaires restent");

  /* 9. Messages d'erreur : un par code, repli sur « autre » */
  ["config", "quota", "sature", "delai", "bloque", "delaiMembre", "autre"].forEach(code =>
    assert.ok(Q.messageErreurJarvis(code).length > 10, code));
  assert.equal(Q.messageErreurJarvis("constructor"), Q.messageErreurJarvis("autre"));
  assert.doesNotMatch(Object.values(["quota", "sature"]).map(Q.messageErreurJarvis).join(" "),
    /payant|factur|abonnement/i, "palier gratuit uniquement");

  /* 10. De bout en bout avec les vrais outils sur le catalogue de test */
  const bout = fauxGemini([appel("fiche_personnage", { nom:"mel", arme:"hache" }), texte("OK")]);
  const r10 = await Q.repondreQuestion({ question:"?", outils:outilsFactices(),
    appelerGemini:bout.appeler, maintenant:MAINTENANT });
  assert.deepEqual(r10.sources, ["fiche Meliodas"]);
  const renvoye = bout.corps[1].contents[2].parts[0].functionResponse.response.resultat;
  assert.deepEqual(renvoye.armes.map(a => a.arme), ["Hache"]);

  /* 10 bis. L'appel HTTP a Gemini et sa politique de reprise, avec un faux
     fetch : seules la saturation et l'injoignabilite se rejouent, jamais un
     429 ; un delai depasse n'est pas rejoue ; la cle ne passe jamais dans
     l'URL. */
  function reponseHttp(status, corps) {
    return { ok:status >= 200 && status < 300, status,
      json:async () => { if(corps instanceof Error) throw corps; return corps; },
      text:async () => JSON.stringify(corps || {}) };
  }
  function fauxFetch(suite) {
    const appels = [];
    const attentes = [];
    return {
      appels, attentes,
      options:{
        corps:{ contents:[1] }, cle:"cle-secrete", modele:"gemini-flash-lite-latest",
        attendre:async ms => { attentes.push(ms); },
        fetch:async (url, init) => {
          appels.push({ url, init });
          const prochain = suite.shift();
          if(prochain instanceof Error) throw prochain;
          return prochain;
        }
      }
    };
  }
  const delaiDepasse = () => new DOMException("trop long", "TimeoutError");
  const sansCode = erreur => erreur.code;

  const reprise = fauxFetch([reponseHttp(503), reponseHttp(503), reponseHttp(200, { ok:1 })]);
  assert.deepEqual(await Q.appelerGeminiAvecReprises(reprise.options), { ok:1 });
  assert.equal(reprise.appels.length, 3);
  assert.deepEqual(reprise.attentes, [700, 1800]);
  const premierAppel = reprise.appels[0];
  assert.equal(premierAppel.url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent");
  assert.doesNotMatch(premierAppel.url, /cle-secrete|key=/, "la cle ne passe jamais dans l'URL");
  assert.equal(premierAppel.init.headers["x-goog-api-key"], "cle-secrete");
  assert.equal(premierAppel.init.method, "POST");
  assert.deepEqual(JSON.parse(premierAppel.init.body), { contents:[1] });
  assert.ok(premierAppel.init.signal, "chaque appel porte son delai");

  const sansCle = fauxFetch([]);
  await assert.rejects(Q.appelerGeminiAvecReprises({ ...sansCle.options, cle:"" }),
    erreur => sansCode(erreur) === "config");
  assert.equal(sansCle.appels.length, 0);

  const quotaHttp = fauxFetch([reponseHttp(429), reponseHttp(200, {})]);
  await assert.rejects(Q.appelerGeminiAvecReprises(quotaHttp.options),
    erreur => sansCode(erreur) === "quota");
  assert.equal(quotaHttp.appels.length, 1, "un 429 n'est jamais rejoue");

  const lentHttp = fauxFetch([delaiDepasse(), reponseHttp(200, {})]);
  await assert.rejects(Q.appelerGeminiAvecReprises(lentHttp.options),
    erreur => sansCode(erreur) === "delai");
  assert.equal(lentHttp.appels.length, 1, "un delai depasse n'est pas rejoue");

  const corpsLent = fauxFetch([reponseHttp(200, delaiDepasse())]);
  await assert.rejects(Q.appelerGeminiAvecReprises(corpsLent.options),
    erreur => sansCode(erreur) === "delai", "le delai court aussi pendant la lecture du corps");

  const sature = fauxFetch([reponseHttp(503), reponseHttp(502), reponseHttp(500)]);
  await assert.rejects(Q.appelerGeminiAvecReprises(sature.options),
    erreur => sansCode(erreur) === "sature");
  assert.equal(sature.appels.length, 3);

  const injoignable = fauxFetch([new TypeError("réseau"), new TypeError("réseau"), new TypeError("réseau")]);
  await assert.rejects(Q.appelerGeminiAvecReprises(injoignable.options),
    erreur => sansCode(erreur) === "sature");
  assert.equal(injoignable.appels.length, 3);

  const refuse = fauxFetch([reponseHttp(400), reponseHttp(200, {})]);
  await assert.rejects(Q.appelerGeminiAvecReprises(refuse.options),
    erreur => sansCode(erreur) === "autre");
  assert.equal(refuse.appels.length, 1, "un 400 n'est pas rejoue");

  /* 10 ter. Le modele de secours. Le 24/09/2026, Flash-Lite et Flash etaient
     satures chez Google pendant que gemini-3.6-flash repondait en 1,6 s : une
     liste de modeles evite qu'une saturation rende /jarvis muet. */
  assert.deepEqual(Q.listeModelesJarvis(" gemini-3.6-flash , gemini-3-flash-preview,,gemini-3.6-flash "),
    ["gemini-3.6-flash", "gemini-3-flash-preview"], "virgules, espaces et doublons");
  assert.deepEqual(Q.listeModelesJarvis(""), Q.listeModelesJarvis(undefined));
  assert.ok(Q.listeModelesJarvis(undefined).length >= 2, "un defaut avec au moins un secours");

  /* Un faux fetch qui repond selon le modele vise par l'URL. */
  function fetchParModele(reponsesParModele) {
    const appels = [];
    return { appels, fetch:async url => {
      const modele = decodeURIComponent(/models\/([^:]+):generateContent/.exec(url)[1]);
      appels.push(modele);
      const suite = reponsesParModele[modele];
      const prochain = Array.isArray(suite) ? suite.shift() : suite;
      if(prochain instanceof Error) throw prochain;
      return prochain;
    } };
  }
  const attendreRien = async () => {};

  const journalSecours = [];
  const saturation = fetchParModele({
    "a":[reponseHttp(503), reponseHttp(503), reponseHttp(503)],
    "b":reponseHttp(200, { ok:"b" })
  });
  const appelerSecours = Q.creerAppelGeminiJarvis({ cle:"k", modeles:["a", "b"],
    fetch:saturation.fetch, attendre:attendreRien, journal:journalSecours });
  assert.deepEqual(await appelerSecours({ contents:[1] }), { ok:"b" });
  assert.deepEqual(saturation.appels, ["a", "a", "a", "b"], "reprises sur a, puis bascule sur b");
  assert.deepEqual(journalSecours, [
    { etape:"modele", modele:"a", issue:"sature" },
    { etape:"modele", modele:"b", issue:"ok" }
  ]);
  /* Un modele qui a repondu reste le premier choix pour la suite de la question. */
  saturation.appels.length = 0;
  assert.deepEqual(await appelerSecours({ contents:[2] }), { ok:"b" });
  assert.deepEqual(saturation.appels, ["b"]);

  const quotaA = fetchParModele({ "a":reponseHttp(429), "b":reponseHttp(200, { ok:"b" }) });
  assert.deepEqual(await Q.creerAppelGeminiJarvis({ cle:"k", modeles:["a", "b"],
    fetch:quotaA.fetch, attendre:attendreRien })({}), { ok:"b" }, "quota épuisé : on bascule");

  const muetA = fetchParModele({ "a":delaiDepasse(), "b":reponseHttp(200, { ok:"b" }) });
  assert.deepEqual(await Q.creerAppelGeminiJarvis({ cle:"k", modeles:["a", "b"],
    fetch:muetA.fetch, attendre:attendreRien })({}), { ok:"b" }, "modèle muet : on bascule");

  const refusA = fetchParModele({ "a":reponseHttp(400), "b":reponseHttp(200, { ok:"b" }) });
  await assert.rejects(Q.creerAppelGeminiJarvis({ cle:"k", modeles:["a", "b"],
    fetch:refusA.fetch, attendre:attendreRien })({}), erreur => erreur.code === "autre");
  assert.deepEqual(refusA.appels, ["a"], "une requête refusée ne s'arrange pas en changeant de modèle");

  const tousSatures = fetchParModele({ "a":reponseHttp(429), "b":reponseHttp(429) });
  await assert.rejects(Q.creerAppelGeminiJarvis({ cle:"k", modeles:["a", "b"],
    fetch:tousSatures.fetch, attendre:attendreRien })({}), erreur => erreur.code === "quota");

  await assert.rejects(Q.creerAppelGeminiJarvis({ cle:"", modeles:["a"],
    fetch:async () => { throw new Error("jamais"); }, attendre:attendreRien })({}),
    erreur => erreur.code === "config");

  /* 11. Le cablage de l'Edge Function, lu dans son source (Deno n'est pas
         executable ici). */
  const index = fs.readFileSync(path.join(ROOT, "supabase", "functions", "discord-planning", "index.ts"), "utf8");
  assert.match(index, /jarvis:publishJarvis/);
  assert.match(index, /reponseDiffereeJarvis\(interaction\)/);
  assert.match(index, /Deno\.env\.get\("GEMINI_JARVIS_API_KEY"\)/);
  assert.match(index, /Deno\.env\.get\("GEMINI_JARVIS_MODEL"\)/);
  assert.doesNotMatch(index, /Deno\.env\.get\("GEMINI_API_KEY"\)/,
    "la cle de lecture-panneau n'est jamais lue par le bot");
  assert.doesNotMatch(index, /Deno\.env\.get\("GEMINI_MODEL"\)/,
    "le modele de lecture-panneau n'est jamais lu par le bot");
  /* L'appel HTTP, ses reprises et ses modeles de secours vivent dans le module
     partage, eprouves aux blocs 10 bis et 10 ter ; l'Edge Function ne fait que
     lui passer fetch, la cle et la liste lue dans le secret. */
  assert.match(index, /listeModelesJarvis\(Deno\.env\.get\("GEMINI_JARVIS_MODEL"\)\)/);
  assert.match(index, /appelerGemini:creerAppelGeminiJarvis\(\{[\s\S]*?modeles:GEMINI_JARVIS_MODELES[\s\S]*?journal[\s\S]*?\}\)/,
    "un appel par question : l'ordre des modeles et le journal lui appartiennent");
  assert.doesNotMatch(index, /generativelanguage\.googleapis\.com/,
    "une seule implementation de l'appel HTTP");

  /* Lot 2a : le bucket prive des monstres, lu par la cle service_role. */
  assert.match(index, /creerLecteurStockageJarvis\(\{[\s\S]{0,200}?nom:"monstres",\s*valider:validerCatalogueMonstres/,
    "les monstres passent par le lecteur commun et son validateur");
  assert.match(index, /"\/storage\/v1\/object\/" \+ CHEMIN_MONSTRES_JARVIS/);
  assert.match(index, /lireMonstres:/);
  /* La lecture du catalogue sur Pages porte un delai, comme celle du stockage. */
  assert.match(index, /fetch\(NOVA_CONNAISSANCES_URL, \{[\s\S]{0,120}?signal:AbortSignal\.timeout\(5_000\)/,
    "un Pages lent ne doit pas bloquer toute la reponse /jarvis");
  /* Le journal des etapes part dans les logs, en cas de succes comme d'echec. */
  assert.match(index, /repondreQuestion\(\{[\s\S]*?journal[\s\S]*?\}\)/);
  assert.match(index, /catch \(error\) \{[\s\S]*?console\.log\(JSON\.stringify\(\{\s*jarvis:\{ code, modeles:GEMINI_JARVIS_MODELES, journal \}/,
    "les modeles configures figurent dans la ligne : un secret pas encore relu ne se voit pas autrement");
  assert.match(index, /jarvis:\{ code:"ok", modeles:GEMINI_JARVIS_MODELES,/);
  assert.match(Q.CONSIGNE_JARVIS, /valeurs de base/);
  assert.match(Q.CONSIGNE_JARVIS, /monstres/);
  /* Un nom vague : Gemini dit quel monstre il a retenu et cite les autres. */
  assert.match(Q.CONSIGNE_JARVIS, /autresCorrespondances/);
  assert.match(Q.CONSIGNE_JARVIS, /la description de la compétence prime/);
  assert.match(Q.CONSIGNE_JARVIS, /nom absent de la description/);
  assert.match(Q.CONSIGNE_JARVIS, /effets et règles du jeu/);
  /* Quatre outils appelés un par un ont coûté 5 appels à une question : le
     palier gratuit de gemini-3.6-flash n'en accorde que 20. */
  assert.match(Q.CONSIGNE_JARVIS, /dans le même tour/);
  /* fiche_effet rend lui aussi « autresCorrespondances ». */
  assert.match(Q.CONSIGNE_JARVIS, /quel monstre ou quel effet tu as retenu/);
  /* La date de l'export survit dans la ligne Sources, meme pour Akumu. */
  const sourceAkumu = "fiche monstre Akumu, bête démoniaque · données du jeu du 22/09/2026";
  assert.match(Q.messageJarvis("?", { texte:"ok", sources:[sourceAkumu] }),
    /Sources : fiche monstre Akumu, bête démoniaque · données du jeu du 22\/09\/2026 ·/);

  console.log("OK discord-jarvis");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
