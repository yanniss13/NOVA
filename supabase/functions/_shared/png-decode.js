"use strict";

/* Lire un PNG, pour que la carte /build puisse afficher les images du jeu.

   Rien dans ce runtime ne decode un webp, et les images du site sont en webp.
   `scripts/generer-vignettes.py` les convertit donc en PNG RGBA 8 bits non
   entrelaces, et ce module les relit. Le perimetre s'arrete la : un PNG
   palette, 16 bits ou entrelace fait echouer la lecture au lieu de rendre une
   image approximative. Nous produisons ces fichiers nous-memes — accepter des
   variantes que nous n'ecrivons jamais serait du code que rien n'exerce.

   L'inflate passe par DecompressionStream, la seule decompression offerte par
   Deno et Node sans dependance : la fonction est donc asynchrone. */

const Buffer = globalThis.Buffer;
if(!Buffer) throw new Error("Buffer indisponible pour la lecture PNG");

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CANAUX = 4;

async function inflate(bytes) {
  if(typeof DecompressionStream !== "function"){
    throw new Error("Décompression PNG indisponible dans ce runtime");
  }
  const flux = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return Buffer.from(await new Response(flux).arrayBuffer());
}

function lireChunks(donnees) {
  const morceaux = [];
  let entete = null;
  let position = 8;
  while(position + 8 <= donnees.length){
    const longueur = donnees.readUInt32BE(position);
    const type = donnees.toString("ascii", position + 4, position + 8);
    const debut = position + 8;
    if(debut + longueur > donnees.length){
      throw new Error("PNG tronqué : le bloc " + type + " dépasse le fichier");
    }
    if(type === "IHDR"){
      entete = {
        width:donnees.readUInt32BE(debut),
        height:donnees.readUInt32BE(debut + 4),
        depth:donnees[debut + 8],
        colorType:donnees[debut + 9],
        interlace:donnees[debut + 12]
      };
    }else if(type === "IDAT"){
      morceaux.push(donnees.subarray(debut, debut + longueur));
    }else if(type === "IEND"){
      break;
    }
    position = debut + longueur + 4;
  }
  return { entete, morceaux };
}

/* Le filtre d'une ligne se defait avec la ligne precedente et le pixel de
   gauche : c'est la definition meme du format, et la raison pour laquelle un
   PNG ne se lit pas ligne par ligne independamment. */
function defiltrer(brut, largeur, hauteur) {
  const pas = largeur * CANAUX;
  const pixels = Buffer.alloc(pas * hauteur);
  for(let ligne = 0; ligne < hauteur; ligne += 1){
    const filtre = brut[ligne * (pas + 1)];
    const source = ligne * (pas + 1) + 1;
    const cible = ligne * pas;
    const precedente = cible - pas;
    for(let octet = 0; octet < pas; octet += 1){
      const valeur = brut[source + octet];
      const gauche = octet >= CANAUX ? pixels[cible + octet - CANAUX] : 0;
      const dessus = ligne > 0 ? pixels[precedente + octet] : 0;
      const diagonale = ligne > 0 && octet >= CANAUX
        ? pixels[precedente + octet - CANAUX] : 0;
      let resultat;
      switch(filtre){
        case 0: resultat = valeur; break;
        case 1: resultat = valeur + gauche; break;
        case 2: resultat = valeur + dessus; break;
        case 3: resultat = valeur + ((gauche + dessus) >> 1); break;
        case 4: {
          const estimation = gauche + dessus - diagonale;
          const ecartGauche = Math.abs(estimation - gauche);
          const ecartDessus = Math.abs(estimation - dessus);
          const ecartDiagonale = Math.abs(estimation - diagonale);
          const proche = ecartGauche <= ecartDessus
            && ecartGauche <= ecartDiagonale
            ? gauche
            : (ecartDessus <= ecartDiagonale ? dessus : diagonale);
          resultat = valeur + proche;
          break;
        }
        default:
          throw new Error("PNG : filtre de ligne inconnu (" + filtre + ")");
      }
      pixels[cible + octet] = resultat & 0xff;
    }
  }
  return pixels;
}

async function decodePng(donnees) {
  const octets = Buffer.isBuffer(donnees) ? donnees : Buffer.from(donnees);
  if(octets.length < 8
    || !SIGNATURE.every((valeur, index) => octets[index] === valeur)){
    throw new Error("PNG : signature absente");
  }
  const { entete, morceaux } = lireChunks(octets);
  if(!entete) throw new Error("PNG : bloc IHDR absent");
  if(entete.depth !== 8 || entete.colorType !== 6 || entete.interlace !== 0){
    throw new Error("PNG : seul le RGBA 8 bits non entrelacé est lu"
      + " (profondeur " + entete.depth + ", type " + entete.colorType
      + ", entrelacement " + entete.interlace + ")");
  }
  const brut = await inflate(Buffer.concat(morceaux));
  const attendu = (entete.width * CANAUX + 1) * entete.height;
  if(brut.length < attendu){
    throw new Error("PNG : données incomplètes après décompression");
  }
  return {
    width:entete.width,
    height:entete.height,
    pixels:defiltrer(brut, entete.width, entete.height)
  };
}

const pngDecodeApi = { decodePng };

if(typeof module !== "undefined" && module.exports){
  module.exports = pngDecodeApi;
}
globalThis.NOVA_PNG_DECODE = pngDecodeApi;
