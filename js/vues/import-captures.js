/* L'import de builds depuis des captures d'ecran.

   Ce module tient les pixels, le worker OCR et la modale ; toute la logique
   testable vit dans `metier/ocr-panneau.js` et `metier/ocr-deduction.js`. C'est
   ce partage qui permet de couvrir la partie qui decide ce qui s'ecrit sans
   jamais ouvrir de navigateur.

   Deux passes d'OCR, et ce n'est pas un luxe : la premiere lit le panneau
   entier pour les libelles, la seconde ne lit qu'une bande a droite — sans
   barre de progression ni libelle — pour les valeurs. Sans la seconde, deux
   valeurs sur six etaient perdues sur mobile.

   Rien n'est ecrit avant le clic final. C'est la seule propriete de surete qui
   compte vraiment : un roster est lu par d'autres membres, et une valeur fausse
   y passerait inapercue. */

import { $, el } from "../noyau/dom.js";
import { gearConfigStatus } from "../metier/build-config.js";
import {
  detecterPanneau, extraireStats,
  seuilColonneValeur, EST_NOMBRE_PANNEAU
} from "../metier/ocr-panneau.js";
import { deduirePiece } from "../metier/ocr-deduction.js";
import { ModalStack } from "./modal-stack.js";

  /* Deux bases differentes cohabitent : un `import()` dynamique se resout
     relativement au MODULE, tandis que le worker et le coeur WASM sont
     recuperes relativement a la PAGE. Une URL absolue tranche les deux d'un
     coup. Elle est calculee a l'appel, jamais au chargement : le chargeur `vm`
     des tests unitaires n'a pas de `document.baseURI` et lever ici casserait
     toute la suite. */
  function baseMoteur(){
    return new URL("vendor/tesseract/", document.baseURI).href;
  }

  /* Sous cette largeur de panneau detecte, la lecture s'effondre : une capture
     passee par une messagerie est souvent redimensionnee, et l'effondrement
     mesure sous 0,6x est brutal. On previent avant de lancer l'OCR plutot que
     de rendre des chiffres faux. */
  const LARGEUR_MINIMALE = 400;

  let worker = null;

  /* Le moteur pese quatre megaoctets : on ne le charge qu'au premier import, et
     une seule fois pour toute la session. */
  async function moteur(){
    if(worker) return worker;
    const base = baseMoteur();
    const tesseract = await import(base + "tesseract.esm.min.js");
    const creer = tesseract.createWorker
      || (tesseract.default && tesseract.default.createWorker);
    worker = await creer("fra", 1, {
      workerPath:base + "worker.min.js",
      /* Le coeur est EPINGLE sur une variante precise. Sans cela le worker
         choisit selon les capacites SIMD du navigateur et reclame un fichier
         qu'on n'a pas verse. Celle-ci embarque son WASM : un seul fichier au
         lieu d'une paire, et aucune requete supplementaire. */
      corePath:base + "tesseract-core-lstm.wasm.js",
      langPath:base,
      /* Le moteur reclame un modele gzippe par defaut. On le sert en
         clair : un fichier de moins a produire, et il reste
         inspectable dans le depot. */
      gzip:false
    });
    return worker;
  }

  async function chargerImage(fichier){
    const image = new Image();
    image.src = URL.createObjectURL(fichier);
    await image.decode();
    return image;
  }

  function luminanceDe(image){
    const toile = document.createElement("canvas");
    toile.width = image.naturalWidth;
    toile.height = image.naturalHeight;
    const contexte = toile.getContext("2d");
    contexte.drawImage(image, 0, 0);
    const pixels = contexte.getImageData(0, 0, toile.width, toile.height).data;
    const largeur = toile.width;
    /* Le seuil vient des captures reelles : le panneau est creme, le fond du
       jeu un ciel etoile. La marge entre les deux est large. */
    return (x, y) => {
      const i = (y * largeur + x) * 4;
      return (pixels[i] * 0.299 + pixels[i + 1] * 0.587
        + pixels[i + 2] * 0.114) > 195;
    };
  }

  function motsDe(donnees){
    const mots = [];
    (donnees.blocks || []).forEach(bloc =>
      (bloc.paragraphs || []).forEach(paragraphe =>
        (paragraphe.lines || []).forEach(ligne =>
          (ligne.words || []).forEach(mot => mots.push(mot)))));
    return mots;
  }

  async function lireCaptureReelle(fichier){
    const image = await chargerImage(fichier);
    const zone = detecterPanneau({
      largeur:image.naturalWidth,
      hauteur:image.naturalHeight,
      estClair:luminanceDe(image)
    });
    if(!zone){
      return { statut:"panneau-introuvable", stats:[] };
    }
    if(zone.width < LARGEUR_MINIMALE){
      return { statut:"resolution-insuffisante", stats:[] };
    }

    const ocr = await moteur();
    const rectangle = {
      left:zone.left, top:zone.top, width:zone.width, height:zone.height
    };
    const plein = await ocr.recognize(fichier, { rectangle }, { blocks:true });
    const motsPleins = motsDe(plein.data);

    /* Seconde passe : la bande des valeurs, isolee des barres de progression
       qui perturbent la segmentation des lignes. */
    const bande = Math.round(zone.width * 0.30);
    await ocr.setParameters({ tessedit_char_whitelist:"0123456789.,%" });
    const droite = await ocr.recognize(fichier, {
      rectangle:{
        left:zone.left + zone.width - bande, top:zone.top,
        width:bande, height:zone.height
      }
    }, { blocks:true });
    await ocr.setParameters({ tessedit_char_whitelist:"" });
    const valeurs = motsDe(droite.data)
      .filter(mot => EST_NOMBRE_PANNEAU.test(String(mot.text).trim()));

    /* La frontiere entre libelles et valeurs vient de la SECONDE passe : elle
       seule voit toutes les valeurs. La deduire de la premiere la placait trop
       a gauche des qu'une valeur y manquait, et le decoupage tranchait alors au
       milieu du dernier mot d'un libelle long. */
    const seuil = valeurs.length
      ? Math.min(...valeurs.map(mot => mot.bbox.x0)) - 12
      : seuilColonneValeur(motsPleins);

    /* On ne garde de la premiere passe que la colonne des libelles : concatener
       les deux passes telles quelles ferait apparaitre chaque valeur en double. */
    const mots = motsPleins.filter(mot => mot.bbox.x1 <= seuil);
    valeurs.forEach(mot => mots.push(mot));

    const stats = extraireStats(mots);
    return { statut:"ok", stats };
  }

  /* Remplacable par les tests : la lecture d'image est la seule partie qu'on ne
     peut exercer ni sans navigateur ni sans fichiers lourds. Tout ce qui suit
     s'en trouve testable a moindre frais. */
  let lireCapture = lireCaptureReelle;
  function __remplacerLecteur(faux){ lireCapture = faux; }

  async function analyserCaptures(fichiers, herosSlug, surProgression){
    const lignes = [];
    const total = fichiers.length;
    for(let i = 0; i < total; i++){
      if(typeof surProgression === "function") surProgression(i, total);
      const lue = await lireCapture(fichiers[i]);
      if(lue.statut !== "ok" || !lue.stats.length){
        lignes.push({
          fichier:fichiers[i],
          statut:"echec",
          raison:lue.statut === "ok" ? "aucune-stat-lue" : lue.statut,
          candidats:[],
          choix:null
        });
        continue;
      }
      const deduite = deduirePiece({ stats:lue.stats, herosSlug });
      lignes.push({
        fichier:fichiers[i],
        statut:deduite.statut === "aucun" ? "echec" : deduite.statut,
        raison:deduite.statut === "aucun" ? "aucune-config-compatible" : null,
        candidats:deduite.candidats,
        /* Une ambiguite n'est jamais preselectionnee : c'est une question posee
           au membre, pas une decision prise a sa place. */
        choix:deduite.statut === "unique" ? deduite.candidats[0] : null
      });
    }
    if(typeof surProgression === "function") surProgression(total, total);
    return lignes;
  }

  let etatCourant = null;

  function nomDePiece(fichier){
    return String(fichier).split("/").pop().replace(/\.webp$/, "");
  }

  function configDeLigne(choix){
    return {
      version:1,
      level:choix.level,
      reinforce:choix.reinforce,
      enchantments:choix.enchantments,
      passiveLevel:choix.passiveLevel === undefined ? null : choix.passiveLevel
    };
  }

  /* Deux captures pour le meme emplacement : on n'en ecrase aucune. Le membre
     tranche, ou rien ne part pour cet emplacement. */
  function emplacementsEnConflit(lignes){
    const vus = new Set();
    const conflits = new Set();
    lignes.forEach(ligne => {
      if(!ligne.choix) return;
      if(vus.has(ligne.choix.slot)) conflits.add(ligne.choix.slot);
      vus.add(ligne.choix.slot);
    });
    return conflits;
  }

  function libelleEtat(ligne){
    if(ligne.statut === "unique") return "lu";
    if(ligne.statut === "ambigu") return "a confirmer";
    return "echec";
  }

  function messageEchec(raison){
    if(raison === "panneau-introuvable"){
      return "Panneau introuvable sur cette image.";
    }
    if(raison === "resolution-insuffisante"){
      return "Image trop petite : envoie le fichier d'origine, non redimensionne.";
    }
    return "Lecture douteuse : aucune configuration ne correspond.";
  }

  function selecteurDeCandidats(ligne){
    const choix = el("select", {
      class:"import-captures-choix",
      onchange(evenement){
        const rang = Number(evenement.target.value);
        ligne.choix = rang >= 0 ? ligne.candidats[rang] : null;
        rendreRecapitulatif();
      }
    });
    choix.appendChild(el("option", { value:"-1", text:"— choisir —" }));
    ligne.candidats.forEach((candidat, rang) => {
      choix.appendChild(el("option", {
        value:String(rang),
        text:nomDePiece(candidat.fichier) + " · niveau " + candidat.level
          + " · +" + candidat.reinforce,
        selected:ligne.choix === candidat
      }));
    });
    return choix;
  }

  function ligneDuTableau(ligne, index, conflits){
    const cellules = [
      el("span", { class:"import-captures-etat", text:libelleEtat(ligne) })
    ];
    if(ligne.statut === "echec"){
      cellules.push(el("span", {
        class:"import-captures-raison", text:messageEchec(ligne.raison)
      }));
    }else if(ligne.statut === "ambigu"){
      cellules.push(selecteurDeCandidats(ligne));
    }
    if(ligne.choix){
      cellules.push(el("span", {
        class:"import-captures-piece", text:nomDePiece(ligne.choix.fichier)
      }));
      cellules.push(el("span", {
        class:"import-captures-detail",
        text:ligne.choix.slot + " · niveau " + ligne.choix.level
          + " · +" + ligne.choix.reinforce
      }));
      const existant = etatCourant.existant[ligne.choix.slot];
      if(existant){
        cellules.push(el("span", {
          class:"import-captures-remplace",
          text:"remplace « " + nomDePiece(existant) + " »"
        }));
      }
      if(conflits.has(ligne.choix.slot)){
        cellules.push(el("span", {
          class:"import-captures-conflit",
          text:"Conflit : deux captures pour cet emplacement."
        }));
      }
    }
    return el("div", {
      class:"import-captures-ligne",
      dataset:{ index:String(index), statut:ligne.statut }
    }, cellules);
  }

  function rendreRecapitulatif(){
    const corps = $("#importCapturesBody");
    const enregistrement = $("#importCapturesSave");
    if(!corps || !etatCourant) return;
    corps.innerHTML = "";
    const conflits = emplacementsEnConflit(etatCourant.lignes);
    etatCourant.lignes.forEach((ligne, index) =>
      corps.appendChild(ligneDuTableau(ligne, index, conflits)));
    const retenues = etatCourant.lignes.filter(ligne =>
      ligne.choix && !conflits.has(ligne.choix.slot));
    if(enregistrement) enregistrement.disabled = retenues.length === 0;
  }

  /* Le dernier verrou. `gearConfigStatus` est le juge de la saisie manuelle :
     une configuration deduite ne doit jamais entrer par une porte qu'une saisie
     a la main n'aurait pas franchie. */
  function enregistrer(){
    const conflits = emplacementsEnConflit(etatCourant.lignes);
    const parEmplacement = {};
    etatCourant.lignes.forEach(ligne => {
      if(!ligne.choix || conflits.has(ligne.choix.slot)) return;
      const config = configDeLigne(ligne.choix);
      if(gearConfigStatus(ligne.choix.fichier, config) !== "valid") return;
      parEmplacement[ligne.choix.slot] = {
        fichier:ligne.choix.fichier, config
      };
    });
    etatCourant.surEnregistrement(parEmplacement);
  }

  function fermerImportCaptures(){
    ModalStack.close($("#importCapturesOverlay"));
    etatCourant = null;
  }

  async function traiterFichiers(fichiers){
    const corps = $("#importCapturesBody");
    corps.innerHTML = "";
    const attente = el("p", {
      class:"import-captures-progression", text:"Lecture des captures…"
    });
    corps.appendChild(attente);
    etatCourant.lignes = await analyserCaptures(
      fichiers,
      etatCourant.herosSlug,
      (fait, total) => {
        attente.textContent = "Lecture " + fait + " sur " + total + "…";
      }
    );
    rendreRecapitulatif();
  }

  function ouvrirImportCaptures(contexte){
    const overlay = $("#importCapturesOverlay");
    if(!overlay) return;
    etatCourant = {
      herosSlug:contexte.herosSlug,
      existant:contexte.existant || {},
      surEnregistrement:contexte.surEnregistrement,
      lignes:[]
    };
    const corps = $("#importCapturesBody");
    corps.innerHTML = "";
    corps.appendChild(el("p", {
      class:"import-captures-aide",
      text:"Dépose les captures de l'écran d'équipement de ce héros. "
        + "L'ordre n'a pas d'importance : l'emplacement se déduit de la pièce. "
        + "Envoie les fichiers d'origine, non redimensionnés."
    }));
    corps.appendChild(el("input", {
      type:"file",
      multiple:true,
      accept:"image/*",
      id:"importCapturesFichiers",
      onchange(evenement){ void traiterFichiers([...evenement.target.files]); }
    }));

    const enregistrement = $("#importCapturesSave");
    enregistrement.disabled = true;
    enregistrement.onclick = () => {
      enregistrer();
      fermerImportCaptures();
    };
    $("#importCapturesCancel").onclick = fermerImportCaptures;
    $("#importCapturesClose").onclick = fermerImportCaptures;
    ModalStack.open(overlay, "#importCapturesFichiers", fermerImportCaptures);
  }

/* Seule la porte d'entree sort d'ici. Les tests pilotent la vraie interface
   avec de vraies captures plutot que d'appeler l'interieur : c'est plus lent,
   mais c'est la seule maniere de verifier aussi le moteur et le decodage
   d'image, et ca evite d'ouvrir une porte derobee en production. */
export { ouvrirImportCaptures };
