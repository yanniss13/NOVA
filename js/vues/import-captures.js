/* L'import de builds depuis des captures d'ecran.

   Ce module tient les pixels, le worker OCR et la modale ; toute la logique
   testable vit dans `metier/ocr-panneau.js` et `metier/ocr-deduction.js`. C'est
   ce partage qui permet de couvrir la partie qui decide ce qui s'ecrit sans
   jamais ouvrir de navigateur.

   Deux passes d'OCR, et ce n'est pas un luxe : la premiere lit le panneau
   entier pour les libelles, la seconde ne lit qu'une bande a droite — sans
   barre de progression ni libelle — pour les valeurs. Sans la seconde, deux
   valeurs sur six etaient perdues sur mobile.

   DEPUIS LA LECTURE ASSISTEE, ces deux passes ne servent plus qu'AU MODE HORS
   LIGNE. Un membre connecte passe par la fonction Edge `lecture-panneau`, qui
   fait lire la capture par un modele : c'est plus fidele, et surtout ca evite
   de telecharger les quatre megaoctets du moteur Tesseract. Le repli reste
   entier — hors ligne, sans compte, ou si l'appel echoue.

   Ce qui ne change pas, et c'est l'essentiel : QUI QUE SOIT LE LECTEUR, le
   resultat passe par `deduireArme` ou `deduirePiece`, qui ne retiennent que
   les configurations dont les totaux recalcules reproduisent ce qui a ete lu.
   Le lecteur remplace l'oeil, jamais le juge.

   Rien n'est ecrit avant le clic final. C'est la seule propriete de surete qui
   compte vraiment : un roster est lu par d'autres membres, et une valeur fausse
   y passerait inapercue. */

import { $, el } from "../noyau/dom.js";
import { ensureBuildStats } from "../noyau/catalogue-build.js";
import { gearConfigStatus, weaponConfigStatus } from "../metier/build-config.js";
import {
  detecterPanneau, detecterEntete, extraireStats, lireEntete, niveauDePassif,
  EST_NOMBRE_PANNEAU
} from "../metier/ocr-panneau.js";
import { deduirePiece } from "../metier/ocr-deduction.js";
import { deduireArme } from "../metier/ocr-arme.js";
import {
  lectureAssisteeDisponible, normaliserLecture
} from "../metier/lecture-assistee.js";
import { sessionCourante } from "../etat/session.js";
import { sb } from "../noyau/supabase-client.js";
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

  /* Au-dessus de cette luminance, un pixel appartient encore a la carte et non
     au ciel etoile derriere elle. C'est ce seuil qui decide si le NOM de la
     piece entre dans la zone lue — et une arme sans nom ne se deduit pas.

     Il valait 80, cale sur des bandeaux dores. Le bandeau du Grimoire
     flamboyant est violet : mesure entre 63 et 75, il passait dessous, si bien
     que la remontee s'arretait au haut de la carte blanche et laissait le titre
     dehors. La couleur du bandeau suit la piece, pas la capture : un seuil cale
     sur une teinte ne tient pas.

     60 garde une marge enorme des deux cotes. Sur la capture violette, le
     bandeau tient a 92-100 % de rangs reconnus, tandis que le ciel juste
     au-dessus du panneau reste a 0 % — il y reste meme a 45. */
  const LUMINANCE_DE_CARTE = 60;

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
      return pixels[i] * 0.299 + pixels[i + 1] * 0.587
        + pixels[i + 2] * 0.114;
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

  /* Le worker Supabase n'a pas besoin du jeu entier : Gemini ne lit que la
     carte de droite. Envoyer une capture ultrawide de 4 a 6 Mo la faisait
     pourtant vivre plusieurs fois en memoire (JSON entrant, base64 nettoye,
     JSON sortant), jusqu'a tuer l'isolate avec WORKER_RESOURCE_LIMIT.

     On recadre donc la carte DANS LE NAVIGATEUR, ou l'image est deja decodee.
     Aucun redimensionnement : un pixel source reste un pixel envoye, parce que
     16.80 et 16.81 designent deux enchantements differents. Le PNG conserve
     egalement ces pixels sans perte. Si le recadrage ne reduit pas le poids,
     le fichier original reste le meilleur transport. */
  function enBase64(fichier){
    return new Promise((resoudre, rejeter) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resoudre(String(lecteur.result));
      lecteur.onerror = () => rejeter(lecteur.error || new Error("lecture"));
      lecteur.readAsDataURL(fichier);
    });
  }

  function blobDeToile(toile){
    return new Promise((resoudre, rejeter) => {
      toile.toBlob(blob => {
        if(blob) resoudre(blob);
        else rejeter(new Error("encodage du panneau impossible"));
      }, "image/png");
    });
  }

  async function imagePourLectureAssistee(fichier){
    const image = await chargerImage(fichier);
    const luminance = luminanceDe(image);
    const zone = detecterPanneau({
      largeur:image.naturalWidth,
      hauteur:image.naturalHeight,
      estClair:(x, y) => luminance(x, y) > 195
    });
    if(!zone) return { fichier, recadree:false };

    const entete = detecterEntete({
      estCarte:(x, y) => luminance(x, y) >= LUMINANCE_DE_CARTE
    }, zone);
    /* Une petite marge garde le lisere de la carte. A droite, le panneau est
       colle au bord de l'image : conserver ce bord est plus robuste que de
       supposer que sa derniere colonne claire contient encore chaque valeur. */
    const marge = Math.max(4, Math.round(zone.width * 0.015));
    const gauche = Math.max(0, zone.left - marge);
    const haut = Math.max(0, (entete ? entete.top : zone.top) - marge);
    const droite = image.naturalWidth;
    const bas = Math.min(image.naturalHeight,
      zone.top + zone.height + marge);
    if(droite <= gauche || bas <= haut) return { fichier, recadree:false };

    const toile = document.createElement("canvas");
    toile.width = droite - gauche;
    toile.height = bas - haut;
    const contexte = toile.getContext("2d");
    contexte.drawImage(image, gauche, haut, toile.width, toile.height,
      0, 0, toile.width, toile.height);
    const panneau = await blobDeToile(toile);
    return panneau.size < fichier.size
      ? { fichier:panneau, recadree:true }
      : { fichier, recadree:false };
  }

  /* Le detail que `functions.invoke` cache.

     Sur un statut non-2xx, supabase-js ne rend qu'un « Edge Function returned
     a non-2xx status code » — le corps, ou vit le vrai motif (« demande un
     compte », « trop lourde », « quota atteint »), reste dans `error.context`,
     une Response non lue. Sans ce detour, toute panne serveur se ressemble. */
  async function motifDuServeur(error){
    const reponse = error && error.context;
    if(!reponse || typeof reponse.text !== "function") return "";
    try{
      const brut = await reponse.text();
      const lu = JSON.parse(brut);
      return (lu && lu.erreur) || brut;
    }catch(erreur){
      return "";
    }
  }

  /* La lecture assistee, ou `null` si elle n'aboutit pas. TOUTE panne rend
     `null` plutot que de lever : l'appelant retombe alors sur Tesseract, et un
     quota epuise ou un reseau coupe ne doit pas priver le membre de son
     import.

     Mais un repli MUET est indiagnostiquable : le membre voit « la lecture
     assistee ne marche pas » sans que rien, nulle part, ne dise a quelle
     etape elle a renonce. Chaque sortie prematuree nomme donc sa raison dans
     la console, et `raisonDuRepli` la porte jusqu'au message d'echec. */
  let raisonDuRepli = "";

  function renoncer(raison, detail){
    raisonDuRepli = raison;
    console.warn("[import] lecture assistée écartée : " + raison,
      detail === undefined ? "" : detail);
    return null;
  }

  async function lireCaptureAssistee(fichier){
    raisonDuRepli = "";
    const etat = {
      client:sb,
      connecte:Boolean(sessionCourante.user),
      enLigne:typeof navigator === "undefined" ? true : navigator.onLine
    };
    if(!lectureAssisteeDisponible(etat)){
      return renoncer(!etat.client ? "aucun client Supabase (config absente)"
        : !etat.connecte ? "aucun compte connecté"
        : "navigateur hors ligne");
    }
    try{
      const preparee = await imagePourLectureAssistee(fichier);
      const image = await enBase64(preparee.fichier);
      /* Le base64 pese un tiers de plus que les octets qu'il code. Le journal
         rend visible le gain du recadrage si une capture atypique pose encore
         probleme, sans jamais journaliser son contenu. */
      const octets = Math.round(image.length * 3 / 4);
      console.info("[import] lecture assistée : envoi de "
        + Math.round(octets / 1024) + " Ko"
        + (preparee.recadree
          ? " (panneau recadré depuis " + Math.round(fichier.size / 1024) + " Ko)"
          : ""));
      const { data, error } = await sb.functions.invoke("lecture-panneau", {
        body:{ image }
      });
      if(error){
        const motif = await motifDuServeur(error);
        return renoncer("la fonction a répondu une erreur"
          + (motif ? " — " + motif : ""), error);
      }
      if(!data) return renoncer("la fonction n'a rien renvoyé");
      const lue = normaliserLecture(data);
      if(lue.statut !== "ok"){
        return renoncer("réponse inexploitable (" + lue.statut + ")", data);
      }
      console.info("[import] lecture assistée réussie", lue);
      return Object.assign(lue, { lecteur:"assiste" });
    }catch(erreur){
      return renoncer("appel impossible", erreur);
    }
  }

  async function lireCaptureReelle(fichier){
    /* Le catalogue est charge a la demande. La lecture OCR peut finir avant
       son injection sur une premiere visite : attendre ici empeche une
       deduction vide, sans ralentir les appels suivants qui reutilisent la
       meme promesse. */
    await ensureBuildStats();

    /* Avant tout traitement d'image : une lecture assistee reussie evite le
       telechargement du moteur, la detection du panneau et les deux passes. */
    const assistee = await lireCaptureAssistee(fichier);
    if(assistee) return assistee;

    const image = await chargerImage(fichier);
    const luminance = luminanceDe(image);
    const zone = detecterPanneau({
      largeur:image.naturalWidth,
      hauteur:image.naturalHeight,
      estClair:(x, y) => luminance(x, y) > 195
    });
    if(!zone){
      return { statut:"panneau-introuvable", stats:[] };
    }
    if(zone.width < LARGEUR_MINIMALE){
      return { statut:"resolution-insuffisante", stats:[] };
    }

    const enteteZone = detecterEntete({
      estCarte:(x, y) => luminance(x, y) >= LUMINANCE_DE_CARTE
    }, zone);
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

    /* On ne DECOUPE pas la premiere passe a une frontiere verticale : elle
       tranchait au milieu du dernier mot des libelles longs, qui partaient
       alors a la poubelle et laissaient « Defense de » au lieu de « Defense de
       l'equipement ».

       On garde donc tous ses mots, et on retire seulement ceux que la seconde
       passe recouvre — meme ligne, meme abscisse. Sans ce retrait, chaque
       valeur apparaitrait deux fois et sa ligne perdrait son nombre. */
    const centreY = mot => (mot.bbox.y0 + mot.bbox.y1) / 2;
    /* Un doublon de valeur est forcement un NOMBRE. Sans cette condition, le
       dernier mot d'un libelle long — qui commence tout pres de la valeur —
       etait pris pour un doublon et jete : « Defense de » au lieu de
       « Defense de l'equipement ». */
    const doublon = mot => EST_NOMBRE_PANNEAU.test(String(mot.text).trim())
      && valeurs.some(valeur =>
        Math.abs(centreY(valeur) - centreY(mot)) < 12
        && valeur.bbox.x0 < mot.bbox.x1 && mot.bbox.x0 < valeur.bbox.x1);
    const mots = motsPleins.filter(mot => !doublon(mot));
    valeurs.forEach(mot => mots.push(mot));

    const stats = extraireStats(mots);
    let motsEntete = [];
    if(enteteZone){
      const enteteLu = await ocr.recognize(fichier, {
        rectangle:enteteZone
      }, { blocks:true });
      motsEntete = motsDe(enteteLu.data);
    }
    const entete = lireEntete(motsEntete);
    const passif = niveauDePassif([...motsPleins, ...motsEntete]
      .map(mot => String(mot.text)).join(" "));
    /* `raisonDuRepli` voyage avec la lecture : c'est la seule facon pour le
       membre d'apprendre POURQUOI Tesseract a pris la main, sans ouvrir la
       console. */
    return { statut:"ok", stats, entete, passif, lecteur:"local",
      raisonAssistee:raisonDuRepli };
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
          lecteur:lue.lecteur || null,
          raisonAssistee:lue.raisonAssistee || "",
          candidats:[],
          choix:null
        });
        continue;
      }
      const deduite = lue.entete && lue.entete.niveau !== null
        ? deduireArme({
          nom:lue.entete.nom,
          niveau:lue.entete.niveau,
          passif:lue.passif === undefined ? null : lue.passif,
          stats:lue.stats,
          herosSlug
        })
        /* Le NOM part avec les statistiques : trois armures liees ont les
           memes courbes, et seul le titre du panneau les separe. Voir
           restreindreParLeNom — il ne sert qu'a restreindre, jamais a
           elargir. */
        : deduirePiece({
          nom:lue.entete ? lue.entete.nom : null,
          stats:lue.stats,
          herosSlug
        });
      /* QUAND RIEN NE COLLE, DIRE CE QU'ON A LU.

         Sans cette trace, un echec d'import est indiagnosticable : le membre
         voit « aucune configuration ne correspond » et personne ne sait si le
         lecteur a mal lu, ou si la piece manque au catalogue. Les lignes lues
         tiennent en trois lignes de console et repondent a la question. */
      if(deduite.statut === "aucun" && typeof console !== "undefined"){
        console.warn("[import] aucune configuration ne correspond"
          + " — lecteur : " + (lue.lecteur || "?")
          + " — heros : " + (herosSlug || "aucun"), {
            nom:lue.entete && lue.entete.nom,
            niveau:lue.entete && lue.entete.niveau,
            passif:lue.passif,
            stats:lue.stats
          });
      }
      lignes.push({
        fichier:fichiers[i],
        statut:deduite.statut === "aucun" ? "echec" : deduite.statut,
        raison:deduite.statut === "aucun" ? "aucune-config-compatible" : null,
        lecteur:lue.lecteur || null,
        raisonAssistee:lue.raisonAssistee || "",
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
    if(choix.slot === "Arme"){
      return {
        version:1,
        gradeGameId:choix.gradeGameId,
        level:choix.level,
        promotion:choix.promotion,
        overlimit:choix.overlimit,
        enchantments:choix.enchantments
      };
    }
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

  /* Le lecteur qui a servi, nomme a l'ecran. Sans lui, un membre qui signale
     un echec ne peut pas dire si la lecture assistee a tourne ou si le site
     est retombe sur le moteur local — et c'est la premiere question a poser. */
  function mentionDuLecteur(lecteur, raisonAssistee){
    if(lecteur === "assiste") return " (lecture assistée)";
    /* Nommer le moteur ne suffit pas : « lecture locale » ne dit pas si le
       membre n'est pas connecte, si le quota est epuise ou si sa capture est
       trop lourde. La raison du repli est exactement ce qu'on lui demanderait
       d'aller chercher dans la console. */
    if(lecteur === "local"){
      return raisonAssistee
        ? " (lecture locale — assistée écartée : " + raisonAssistee + ")"
        : " (lecture locale)";
    }
    return "";
  }

  function messageEchec(raison, lecteur, raisonAssistee){
    if(raison === "panneau-introuvable"){
      return "Panneau introuvable sur cette image."
        + mentionDuLecteur(lecteur, raisonAssistee);
    }
    if(raison === "resolution-insuffisante"){
      return "Image trop petite : envoie le fichier d'origine, non redimensionne."
        + mentionDuLecteur(lecteur, raisonAssistee);
    }
    return "Lecture douteuse : aucune configuration ne correspond."
      + mentionDuLecteur(lecteur, raisonAssistee)
      + " Le détail de ce qui a été lu est dans la console du navigateur.";
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
        text:nomDePiece(candidat.fichier) + " · " + detailDuChoix(candidat),
        selected:ligne.choix === candidat
      }));
    });
    return choix;
  }

  function detailDuChoix(choix){
    const remplis = (choix.enchantments || []).filter(entry => entry !== null).length;
    const detailEnchantements = remplis + " enchantement"
      + (remplis > 1 ? "s" : "") + " rempli" + (remplis > 1 ? "s" : "");
    if(choix.slot !== "Arme"){
      return choix.slot + " · niveau " + choix.level + " · +" + choix.reinforce
        + " · " + detailEnchantements;
    }
    const details = ["Arme", "niveau " + choix.level,
      "grade " + choix.gradeGameId, "promotion " + choix.promotion,
      "outrepassement " + choix.overlimit,
      detailEnchantements];
    if(choix.elementSuppose) details.push("élément supposé");
    return details.join(" · ");
  }

  function ligneDuTableau(ligne, index, conflits){
    const cellules = [
      el("span", { class:"import-captures-etat", text:libelleEtat(ligne) })
    ];
    if(ligne.statut === "echec"){
      cellules.push(el("span", {
        class:"import-captures-raison",
        text:messageEchec(ligne.raison, ligne.lecteur, ligne.raisonAssistee)
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
        text:detailDuChoix(ligne.choix)
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

  /* Le dernier verrou : chaque famille passe par le juge de sa saisie manuelle. */
  function enregistrer(){
    const conflits = emplacementsEnConflit(etatCourant.lignes);
    const parEmplacement = {};
    etatCourant.lignes.forEach(ligne => {
      if(!ligne.choix || conflits.has(ligne.choix.slot)) return;
      const config = configDeLigne(ligne.choix);
      const statut = ligne.choix.slot === "Arme"
        ? weaponConfigStatus(ligne.choix.fichier, config)
        : gearConfigStatus(ligne.choix.fichier, config);
      if(statut !== "valid") return;
      parEmplacement[ligne.choix.slot] = {
        fichier:ligne.choix.fichier, config
      };
    });
    etatCourant.surEnregistrement(parEmplacement);
  }

  let ecouteurCollage = null;

  function retirerEcouteurCollage(){
    if(!ecouteurCollage) return;
    document.removeEventListener("paste", ecouteurCollage);
    ecouteurCollage = null;
  }

  function fermerImportCaptures(){
    ModalStack.close($("#importCapturesOverlay"));
  }

  function nettoyerImportCaptures(){
    retirerEcouteurCollage();
    etatCourant = null;
  }

  function imagesParmi(fichiers){
    return [...(fichiers || [])].filter(fichier =>
      fichier && typeof fichier.type === "string"
        && fichier.type.toLowerCase().startsWith("image/"));
  }

  function afficherMessageDepot(texte){
    const message = $(".import-captures-depot-message");
    if(message) message.textContent = texte || "";
  }

  function fichiersDuPressePapiers(donnees){
    const depuisItems = [...(donnees && donnees.items || [])]
      .filter(item => item.kind === "file")
      .map(item => item.getAsFile())
      .filter(Boolean);
    return depuisItems.length
      ? depuisItems : [...(donnees && donnees.files || [])];
  }

  function traiterEntreeFichiers(fichiers){
    const images = imagesParmi(fichiers);
    if(!images.length){
      afficherMessageDepot(
        "Aucune image détectée. Colle ou dépose une capture au format image."
      );
      return false;
    }
    /* Le presse-papiers reste global pendant la lecture et le recapitulatif.
       Sans ce verrou, un second Ctrl+V peut lancer une autre analyse, puis
       remplacer silencieusement le premier resultat. Une ouverture accepte
       donc un seul lot — ce lot peut contenir plusieurs images. */
    if(!etatCourant || etatCourant.importLance) return Boolean(etatCourant);
    afficherMessageDepot("");
    const sessionImport = etatCourant;
    sessionImport.importLance = true;
    sessionImport.enLecture = true;
    void traiterFichiers(images, sessionImport);
    return true;
  }

  function creerZoneDepot(){
    let profondeurGlissement = 0;
    const entree = el("input", {
      type:"file",
      multiple:true,
      accept:"image/*",
      id:"importCapturesFichiers",
      class:"import-captures-fichiers",
      "aria-label":"Choisir des captures d'écran",
      onchange(evenement){
        traiterEntreeFichiers(evenement.target.files);
      }
    });
    const zone = el("div", {
      class:"import-captures-depot",
      ondragenter(evenement){
        evenement.preventDefault();
        profondeurGlissement++;
        zone.classList.add("is-dragging");
      },
      ondragover(evenement){
        evenement.preventDefault();
        if(evenement.dataTransfer) evenement.dataTransfer.dropEffect = "copy";
      },
      ondragleave(){
        profondeurGlissement = Math.max(0, profondeurGlissement - 1);
        if(!profondeurGlissement) zone.classList.remove("is-dragging");
      },
      ondragend(){
        profondeurGlissement = 0;
        zone.classList.remove("is-dragging");
      },
      ondrop(evenement){
        evenement.preventDefault();
        profondeurGlissement = 0;
        zone.classList.remove("is-dragging");
        traiterEntreeFichiers(evenement.dataTransfer
          && evenement.dataTransfer.files);
      }
    }, [
      el("span", {
        class:"import-captures-depot-icone",
        "aria-hidden":"true",
        text:"↓"
      }),
      el("strong", { text:"Glisse tes captures ici" }),
      el("span", {
        class:"import-captures-depot-raccourci",
        text:"ou colle-les avec Ctrl+V"
      }),
      el("span", {
        class:"import-captures-depot-bouton",
        text:"Choisir des images"
      }),
      el("span", {
        class:"import-captures-depot-message",
        role:"status",
        "aria-live":"polite"
      }),
      entree
    ]);
    return zone;
  }

  async function traiterFichiers(fichiers, sessionImport){
    const corps = $("#importCapturesBody");
    corps.innerHTML = "";
    const attente = el("p", {
      class:"import-captures-progression",
      role:"status",
      "aria-live":"polite",
      text:"Lecture des captures…"
    });
    corps.appendChild(attente);
    try{
      const lignes = await analyserCaptures(
        fichiers,
        sessionImport.herosSlug,
        (fait, total) => {
          attente.textContent = "Lecture " + fait + " sur " + total + "…";
        }
      );
      /* Une analyse peut finir apres fermeture, voire apres la reouverture de
         la meme modale pour un autre heros. Son resultat appartient a son
         ancienne session : il ne doit jamais remplacer le nouveau contenu. */
      if(etatCourant !== sessionImport) return;
      sessionImport.lignes = lignes;
      rendreRecapitulatif();
    }finally{
      if(etatCourant === sessionImport) sessionImport.enLecture = false;
    }
  }

  function ouvrirImportCaptures(contexte){
    const overlay = $("#importCapturesOverlay");
    if(!overlay) return;
    etatCourant = {
      herosSlug:contexte.herosSlug,
      existant:contexte.existant || {},
      surEnregistrement:contexte.surEnregistrement,
      lignes:[],
      importLance:false,
      enLecture:false
    };
    const corps = $("#importCapturesBody");
    corps.innerHTML = "";
    corps.appendChild(el("p", {
      class:"import-captures-aide",
      text:"Dépose les captures de l'écran d'équipement de ce héros. "
        + "L'ordre n'a pas d'importance : l'emplacement se déduit de la pièce. "
        + "Envoie les fichiers d'origine, non redimensionnés."
    }));
    corps.appendChild(creerZoneDepot());

    retirerEcouteurCollage();
    ecouteurCollage = evenement => {
      if(!etatCourant) return;
      const donnees = evenement.clipboardData;
      if(!donnees) return;
      const fichiers = fichiersDuPressePapiers(donnees);
      if(traiterEntreeFichiers(fichiers)) evenement.preventDefault();
    };
    document.addEventListener("paste", ecouteurCollage);

    const enregistrement = $("#importCapturesSave");
    enregistrement.disabled = true;
    enregistrement.onclick = () => {
      enregistrer();
      fermerImportCaptures();
    };
    $("#importCapturesCancel").onclick = fermerImportCaptures;
    $("#importCapturesClose").onclick = fermerImportCaptures;
    ModalStack.open(
      overlay,
      "#importCapturesFichiers",
      fermerImportCaptures,
      undefined,
      nettoyerImportCaptures
    );
  }

/* Seule la porte d'entree sort d'ici. Les tests pilotent la vraie interface
   avec de vraies captures plutot que d'appeler l'interieur : c'est plus lent,
   mais c'est la seule maniere de verifier aussi le moteur et le decodage
   d'image, et ca evite d'ouvrir une porte derobee en production. */
export { ouvrirImportCaptures };
