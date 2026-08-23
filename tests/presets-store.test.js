"use strict";

/* Le store, sans reseau ni navigateur : un faux Supabase capture ce qui part,
   un faux localStorage garde ce qui reste. Ce qu'on verifie ici est la
   frontiere, pas PostgREST. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
/* Meme epilogue que tests/presets.test.js : un `const` de haut niveau
   n'atterrit pas sur l'objet global d'un contexte `vm`. */
const source = fs.readFileSync(
  path.join(racine, "js", "donnees", "presets-store.js"), "utf8"
).replace(/^import[\s\S]*?;\s*$/gm, "")
  .replace(/^export\s*\{[\s\S]*?\}\s*;\s*$/m, "")
  + "\nglobalThis.__api = { PresetsStore };";

const memoire = new Map();
const envois = [];
/* Le faux serveur garde vraiment ce qu'on lui envoie : sans cela une relecture
   viderait le cache, et le test ne verrait pas la difference. */
const lignes = [];
let lectures = 0;

const bac = {
  CLOUD_PRESETS_CACHE_KEY:"confrerie7ds.cloud.presets",
  PRESETS_MAX:40,
  nomPresetValide:nom => {
    const propre = String(nom == null ? "" : nom).trim();
    return propre.length >= 1 && propre.length <= 40 ? propre : null;
  },
  normaliserPreset:source => source && typeof source === "object" ? {
    armor:source.armor || {}, armorConfig:source.armorConfig || {},
    jewel:source.jewel || {}, jewelConfig:source.jewelConfig || {}
  } : null,
  sessionCourante:{ user:{ id:"u1" } },
  localStorage:{
    getItem:cle => memoire.has(cle) ? memoire.get(cle) : null,
    setItem:(cle, valeur) => { memoire.set(cle, String(valeur)); }
  },
  crypto:{ randomUUID:() => "uuid-" + (envois.length + 1) },
  sb:{
    from(){
      const requete = {
        select(){ return requete; },
        eq(){ return requete; },
        order(){
          lectures += 1;
          return Promise.resolve({ data:lignes.slice(), error:null });
        },
        upsert(payload){
          envois.push(["upsert", payload]);
          const index = lignes.findIndex(ligne => ligne.id === payload.id);
          if(index >= 0) lignes[index] = payload;
          else lignes.push(payload);
          return Promise.resolve({ error:null });
        },
        delete(){
          return { eq(){ return { eq(cle, valeur){
            envois.push(["delete", valeur]);
            const index = lignes.findIndex(ligne => ligne.id === valeur);
            if(index >= 0) lignes.splice(index, 1);
            return Promise.resolve({ error:null });
          } }; } };
        }
      };
      return requete;
    }
  }
};
vm.runInNewContext(source, bac, { filename:"presets-store.js" });
const { PresetsStore } = bac.__api;

(async () => {
  /* Sans rien en cache, la liste est vide et ne jette pas. On mesure la
     longueur : un tableau ne du `vm` n'a pas l'`Array.prototype` du test. */
  assert.equal(PresetsStore.all().length, 0);

  // Un nom vide n'atteint jamais le reseau.
  await assert.rejects(
    () => PresetsStore.save("   ", { armor:{}, jewel:{} }),
    /NOM_INVALIDE/
  );
  assert.equal(envois.length, 0, "aucun envoi ne doit partir sur un nom vide");

  // Un enregistrement part en upsert, avec le proprietaire de la session.
  const apres = await PresetsStore.save("Boss", {
    armor:{ Haut:"h.webp" }, armorConfig:{}, jewel:{}, jewelConfig:{}
  });
  assert.equal(envois.length, 1);
  assert.equal(envois[0][0], "upsert");
  assert.equal(envois[0][1].owner, "u1");
  assert.equal(envois[0][1].nom, "Boss");
  assert.equal(typeof envois[0][1].id, "string");
  assert.equal(envois[0][1].payload.armor.Haut, "h.webp");
  assert.equal(apres.length, 1);
  assert.equal(apres[0].nom, "Boss");

  // Le cache local a retenu, sans nouvel appel.
  assert.equal(PresetsStore.all().length, 1);
  assert.equal(envois.length, 1);

  // Le nom est nettoye avant de partir.
  await PresetsStore.save("  Espaces  ", { armor:{}, jewel:{} });
  assert.equal(envois[1][1].nom, "Espaces");

  // Corriger un preset existant ne cree pas de doublon.
  const identite = apres[0].id;
  const corrige = await PresetsStore.save("Boss v2", { armor:{}, jewel:{} }, identite);
  assert.equal(corrige.filter(preset => preset.id === identite).length, 1);
  assert.equal(
    corrige.find(preset => preset.id === identite).nom, "Boss v2"
  );

  // La suppression cible l'identifiant.
  const restants = await PresetsStore.remove(identite);
  assert.equal(restants.some(preset => preset.id === identite), false);
  assert.equal(envois[envois.length - 1][0], "delete");
  assert.equal(envois[envois.length - 1][1], identite);

  // La limite est un refus net, pas un envoi silencieux.
  while(PresetsStore.all().length < 40){
    await PresetsStore.save("preset " + PresetsStore.all().length, {
      armor:{ Haut:"h.webp" }, jewel:{}
    });
  }
  const avant = envois.length;
  await assert.rejects(
    () => PresetsStore.save("de trop", { armor:{ Haut:"h.webp" }, jewel:{} }),
    /TROP_DE_PRESETS/
  );
  assert.equal(envois.length, avant, "le refus ne doit rien envoyer");

  // Corriger un preset existant reste possible a la limite.
  const dernier = PresetsStore.all()[0];
  await PresetsStore.save("renomme", { armor:{}, jewel:{} }, dernier.id);
  assert.equal(PresetsStore.all().length, 40);

  /* Les ecrans ne decident pas quand relire : ils demandent le chargement, et
     le store ne va au reseau qu'une fois par membre. Sans cela, chaque ecran
     dupliquerait la meme garde — et celui qu'on oublierait afficherait une
     liste vide sur un appareil neuf. */
  const lecturesAvant = lectures;
  const charges = await PresetsStore.ensureLoaded();
  assert.equal(lectures, lecturesAvant + 1, "le premier chargement lit le serveur");
  assert.equal(charges.length, 40, "la relecture ne doit pas vider le cache");

  await PresetsStore.ensureLoaded();
  assert.equal(lectures, lecturesAvant + 1, "le second appel ne relit pas");

  console.log("presets-store.test.js : OK");
})().catch(erreur => {
  console.error(erreur);
  process.exit(1);
});
