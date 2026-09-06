"use strict";

/* Le decodeur PNG de l'Edge Function.

   Il existe parce que la carte /build affiche les images du jeu, et que rien
   dans Deno ne decode un webp. Les vignettes sont donc publiees en PNG RGBA
   8 bits non entrelace — exactement ce que ce decodeur lit, et rien de plus.

   `decodePng` est asynchrone : l'inflate passe par DecompressionStream, la
   seule decompression disponible dans ce runtime.

   Le test s'appuie sur les vignettes reelles quand elles sont la
   (`python scripts/generer-vignettes.py`), et sur une image fabriquee ici
   sinon : la CI ne doit pas dependre d'un dossier ignore par git. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const {
  decodePng
} = require(path.join(ROOT, "supabase", "functions", "_shared", "png-decode.js"));
const {
  RasterCanvas, encodePng, atlasStringWidthExact, chargerAtlasCarte
} = require(path.join(
  ROOT, "supabase", "functions", "_shared", "availability-pdf.js"
));

(async () => {
  /* Aller-retour : ce que l'encodeur du planning ecrit, ce decodeur le relit.
     Les deux vivent dans le meme depot ; s'ils divergeaient, la carte
     afficherait des couleurs fausses sans que rien n'echoue. */
  const canvas = new RasterCanvas(9, 5, [10, 20, 30, 255]);
  canvas.rectangle(2, 1, 3, 2, [200, 100, 50, 255]);
  const image = await decodePng(await encodePng(canvas));
  assert.equal(image.width, 9);
  assert.equal(image.height, 5);
  assert.equal(image.pixels.length, 9 * 5 * 4);
  const pixel = (x, y) => Array.from(
    image.pixels.subarray((y * 9 + x) * 4, (y * 9 + x) * 4 + 4)
  );
  assert.deepEqual(pixel(0, 0), [10, 20, 30, 255], "le fond");
  assert.deepEqual(pixel(3, 2), [200, 100, 50, 255], "le rectangle dessine");
  assert.deepEqual(pixel(8, 4), [10, 20, 30, 255], "le dernier pixel");

  /* La transparence doit survivre : sans elle, chaque icone arriverait dans un
     carre noir sur le panneau violet. */
  const transparent = new RasterCanvas(4, 4, [0, 0, 0, 0]);
  transparent.rectangle(1, 1, 2, 2, [255, 255, 255, 255]);
  const relu = await decodePng(await encodePng(transparent));
  assert.equal(relu.pixels[3], 0, "le coin doit rester transparent");
  assert.equal(relu.pixels[(1 * 4 + 1) * 4 + 3], 255);

  /* Une vignette reelle, produite par Pillow : un autre encodeur, d'autres
     filtres par ligne. C'est le cas que la commande rencontre en production. */
  const vignette = path.join(ROOT, "7ds-vignettes", "7ds-personnages", "ban.png");
  if(fs.existsSync(vignette)){
    const portrait = await decodePng(fs.readFileSync(vignette));
    assert.equal(portrait.width, 288, "la taille d'affichage du portrait");
    assert.equal(portrait.height, 288);
    const opaques = [];
    for(let index = 3; index < portrait.pixels.length; index += 4){
      if(portrait.pixels[index] > 200) opaques.push(index);
    }
    assert.ok(opaques.length > 1000,
      "un portrait entierement transparent trahit un filtre mal defait");
  }

  /* Ce qui n'est pas un PNG RGBA 8 bits doit echouer clairement, pas rendre
     une image fausse. */
  await assert.rejects(() => decodePng(Buffer.from("pas un png")), /PNG/);

  /* Poser une image decodee sur la surface de dessin. Les icones du jeu sont
     detourees : la transparence doit laisser voir le panneau, et un demi-alpha
     se melanger au fond au lieu de l'ecraser. */
  const fond = new RasterCanvas(4, 4, [0, 0, 0, 255]);
  const icone = {
    width:2,
    height:2,
    pixels:Buffer.from([
      255, 255, 255, 255, 255, 255, 255, 128,
      0, 0, 0, 0, 255, 0, 0, 255
    ])
  };
  fond.drawImage(icone, 1, 1);
  const surFond = (x, y) => Array.from(
    fond.pixels.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)
  );
  assert.deepEqual(surFond(1, 1), [255, 255, 255, 255], "opaque : recopie");
  assert.deepEqual(surFond(2, 1), [128, 128, 128, 255],
    "un demi-alpha se melange au fond");
  assert.deepEqual(surFond(1, 2), [0, 0, 0, 255],
    "transparent : le fond reste intact");
  assert.deepEqual(surFond(2, 2), [255, 0, 0, 255]);
  assert.deepEqual(surFond(0, 0), [0, 0, 0, 255], "hors de la zone posee");

  /* Une image posee a cheval sur le bord ne doit ni deborder ni faire tomber
     le rendu : elle se coupe. */
  fond.drawImage(icone, 3, 3);
  assert.deepEqual(surFond(3, 3), [255, 255, 255, 255]);

  /* ECRIRE SANS TOUT METTRE EN CAPITALES.
     `atlasText` met en capitales et retire les accents : c'est ce que veut le
     planning, dont l'atlas ne connait que des capitales. La carte /build a le
     sien, avec minuscules et accents — il lui faut donc un trace qui respecte
     ce qu'on lui donne. Sans lui, « Dégâts » resterait « DEGATS ». */
  require(path.join(ROOT, "supabase", "functions", "_shared", "carte-font.js"));
  const atlas = await chargerAtlasCarte();
  const dessiner = (methode, texte) => {
    const surface = new RasterCanvas(240, 60, [0, 0, 0, 255]);
    surface[methode](4, 4, texte, atlas.corps, [255, 255, 255, 255]);
    return surface.pixels.toString("base64");
  };
  assert.notEqual(dessiner("atlasTextExact", "e"),
    dessiner("atlasTextExact", "E"),
    "une minuscule et sa capitale ne se dessinent pas pareil");
  assert.equal(dessiner("atlasText", "e"), dessiner("atlasText", "E"),
    "le trace du planning, lui, met bien tout en capitales");
  assert.notEqual(dessiner("atlasTextExact", "Dégâts"),
    dessiner("atlasTextExact", "Degats"),
    "les accents doivent survivre");

  /* La largeur mesuree doit suivre le meme chemin que le trace, sinon rien ne
     s'aligne : une valeur calee a droite tomberait a cote. */
  assert.notEqual(
    atlasStringWidthExact("dégâts", atlas.corps),
    atlasStringWidthExact("DEGATS", atlas.corps),
    "la mesure doit distinguer casse et accents comme le trace");

  console.log("OK png-decode");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
