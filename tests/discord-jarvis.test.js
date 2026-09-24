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
  const tetu = fauxGemini([1, 2, 3, 4, 5].map(() => appel("fiche_personnage", {})));
  await assert.rejects(Q.repondreQuestion({ question:"?", outils:fauxOutils(),
    appelerGemini:tetu.appeler, maintenant:MAINTENANT }), erreur => erreur.code === "bloque");

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

  /* 11. Le cablage de l'Edge Function, lu dans son source (Deno n'est pas
         executable ici). */
  const index = fs.readFileSync(path.join(ROOT, "supabase", "functions", "discord-planning", "index.ts"), "utf8");
  assert.match(index, /jarvis:publishJarvis/);
  assert.match(index, /reponseDiffereeJarvis\(interaction\)/);
  assert.match(index, /Deno\.env\.get\("GEMINI_JARVIS_API_KEY"\)/);
  assert.match(index, /Deno\.env\.get\("GEMINI_JARVIS_MODEL"\)/);
  assert.doesNotMatch(index, /Deno\.env\.get\("GEMINI_API_KEY"\)/,
    "la cle de lecture-panneau n'est jamais lue par le bot");
  assert.match(index, /"x-goog-api-key"/);
  assert.doesNotMatch(index, /generateContent\?key=/, "la cle ne passe jamais dans l'URL");

  console.log("OK discord-jarvis");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
