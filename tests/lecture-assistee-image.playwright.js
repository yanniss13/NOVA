"use strict";

/* La lecture distante ne doit jamais transporter tout le decor d'une capture
   ultrawide. Cette regression passe par le vrai navigateur, le vrai decodage
   PNG et le vrai detecteur de panneau ; seul l'appel reseau est remplace afin
   d'observer exactement le corps qui partirait vers l'Edge Function. */

const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");

(async () => {
  const serveur = await serveRepo();
  const navigateur = await chromium.launch({ headless:true });
  try{
    const page = await navigateur.newPage();
    await installFakeSupabase(page);
    await page.goto(serveur.url + "/index.html");

    await page.evaluate(() => {
      window.__lectureAssisteePayload = "";
      window.__fakeSupabaseClient.functions = {
        async invoke(nom, options){
          assertNom(nom);
          window.__lectureAssisteePayload = options.body.image;
          /* Une lecture exploitable suffit : la reconnaissance de l'arme
             n'est pas l'objet de ce test et peut finir en ligne « echec ». */
          return {
            data:{
              nom:"Capture de test",
              niveau:null,
              passif:null,
              stats:[{ libelle:"Attaque", valeur:"1", section:null }]
            },
            error:null
          };
        }
      };
      function assertNom(nom){
        if(nom !== "lecture-panneau") throw new Error("fonction inattendue");
      }
      window.__fakeSupabaseApplySession({
        id:"user-1", email:"yannis@example.test"
      });
    });
    await page.waitForFunction(() =>
      !document.querySelector("#accountConnected").hidden);

    await page.evaluate(async () => {
      const module = await import("./js/vues/import-captures.js");
      module.ouvrirImportCaptures({
        herosSlug:"dreyfus", existant:{}, surEnregistrement(){}
      });
    });

    const fixture = path.join(__dirname, "fixtures", "ocr",
      "ultrawide-arme-rapiere.png");
    await page.locator("#importCapturesFichiers").setInputFiles(fixture);
    await page.waitForFunction(() => Boolean(window.__lectureAssisteePayload),
      null, { timeout:10000 });

    const envoye = await page.evaluate(async () => {
      const source = window.__lectureAssisteePayload;
      const donnees = source.slice(source.indexOf(",") + 1);
      const image = new Image();
      image.src = source;
      await image.decode();
      return {
        type:source.slice(0, source.indexOf(",")),
        octets:Math.floor(donnees.length * 3 / 4),
        largeur:image.naturalWidth,
        hauteur:image.naturalHeight
      };
    });

    assert.match(envoye.type, /^data:image\/png;base64$/,
      "le panneau doit rester un PNG sans perte");
    assert.ok(envoye.largeur < 1200,
      "la largeur ultrawide doit etre retiree, pas envoyee a Supabase");
    assert.ok(envoye.hauteur <= 1440,
      "le panneau ne doit jamais etre agrandi");
    assert.ok(envoye.octets < 3 * 1024 * 1024,
      "le panneau recadre doit tenir sous la garde du worker");

    console.log("lecture-assistee-image.playwright.js OK ("
      + Math.round(envoye.octets / 1024) + " Ko, "
      + envoye.largeur + "x" + envoye.hauteur + ")");
  } finally {
    await navigateur.close();
    await serveur.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
