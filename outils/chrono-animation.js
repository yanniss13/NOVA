"use strict";

/* La page de chronometrage.

   Une mesure vaut pour UN gameId : un heros, une arme, une competence.
   Meliodas a la hache et Meliodas a l'epee longue n'ont pas le meme moveset,
   leurs animations se mesurent donc separement.

   Les competences non chiffrables sont ecartees : sans pourcentage de degats,
   leur animation n'entre dans aucun calcul de DPS. Restent 347 mesures, le
   compte exact de docs/chronometrage-animations.md — 335 avant que Ban
   n'arrive avec la version 2.0 du jeu, le 26 aout 2026.

   La cadence sert uniquement a afficher un numero d'image lisible et a fixer
   le pas des fleches. Le calcul de duree n'utilise que currentTime : il reste
   juste meme si la cadence declaree ne correspond pas a l'enregistrement. */

(function(){
  const CADENCE = 60;

  const ARMES = {
    Axe:"Hache", Book:"Grimoire", SwordDual:"Épées doubles", Rapier:"Rapière",
    Shield:"Épée & bouclier", Lance:"Lance", Sword1h:"Épée à une main",
    Cudgel3c:"Nunchaku", Gauntlets:"Gantelets", Sword2h:"Épée à deux mains",
    Staff:"Bâton", Wand:"Baguette"
  };
  const ORDRE = ["NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL"];
  const CATEGORIES = {
    NORMAL:{ nom:"Attaque normale", touche:"clic gauche" },
    NORMAL_SKILL:{ nom:"Compétence normale", touche:"E" },
    ACTIVE_THIRD:{ nom:"Attaque spéciale", touche:"Q" },
    ULTIMATE:{ nom:"Attaque ultime", touche:"R" },
    TAG_SKILL:{ nom:"Compétence de relève", touche:"1 à 4" }
  };

  const video = document.getElementById("video");
  const etat = {
    secondeDebut:null, secondeFin:null, cadence:CADENCE, mesurees:new Set(),
    /* mediaTime est le temps EXACT de l'image affichee, donne par le
       navigateur. currentTime, lui, est la position demandee : apres un
       saut il ne correspond a aucune image precise. */
    mediaTime:null, dureeImage:0, viseeRecul:null,
    /* Point de depart de la mesure de cadence : le temps et le numero d'image
       d'ou l'on compte. La cadence se lit sur la distance entre cette ancre et
       l'image courante, jamais sur deux images voisines. */
    ancre:null, suiviActif:false
  };

  // Images a laisser defiler avant d'annoncer une cadence.
  const FENETRE = 30;
  // Au-dela, on re-ancre : une fenetre sans fin finirait par lisser un changement.
  const FENETRE_MAX = 300;

  const $ = id => document.getElementById(id);

  /* Les noms francais vivent dans le wiki, le catalogue de calcul est en
     anglais. Sans le wiki on affiche le nom d'origine plutot que rien. */
  function nomFrancais(gameId){
    const wiki = window.SEVEN_DS_WIKI_COMPETENCES || {};
    for(const liste of Object.values(wiki)){
      const trouvee = liste.find(skill => skill.gameId === gameId);
      if(trouvee && trouvee.nomFr) return trouvee.nomFr;
    }
    return null;
  }

  function mesurablesDe(nomHeros){
    return ((window.SEVEN_DS_COMPETENCES || {})[nomHeros] || [])
      .filter(competence => competence.gameId
        && competence.nature !== "non-chiffree");
  }

  function tousLesHeros(){
    return Object.keys(window.SEVEN_DS_COMPETENCES || {})
      .filter(nom => mesurablesDe(nom).length)
      .sort();
  }

  function armesDe(nomHeros){
    return [...new Set(mesurablesDe(nomHeros).map(c => c.weaponType))]
      .sort((a, b) => (ARMES[a] || a).localeCompare(ARMES[b] || b));
  }

  function competencesDe(nomHeros, arme){
    return mesurablesDe(nomHeros)
      .filter(competence => competence.weaponType === arme)
      .sort((a, b) => ORDRE.indexOf(a.categorie) - ORDRE.indexOf(b.categorie));
  }

  function libelleDe(competence){
    const categorie = CATEGORIES[competence.categorie];
    const nom = nomFrancais(competence.gameId) || competence.nom;
    return categorie
      ? nom + " — " + categorie.nom + " (" + categorie.touche + ")"
      : nom;
  }

  function competenceChoisie(){
    const nomHeros = $("heros").value;
    const arme = $("arme").value;
    const gameId = $("competence").value;
    return competencesDe(nomHeros, arme)
      .find(competence => competence.gameId === gameId) || null;
  }

  function modeChoisi(){
    const coche = document.querySelector("input[name=mode]:checked");
    return coche ? coche.value : "rafale";
  }

  function synchroniserProtocole(){
    const competence = competenceChoisie();
    if(!competence) return;
    const protocole = window.ChronoCalcul.protocolePour(competence.gameId);
    document.querySelectorAll("input[name=mode]").forEach(radio => {
      radio.checked = radio.value === protocole.mode;
      radio.disabled = true;
    });
    const repetitions = $("repetitions");
    repetitions.disabled = protocole.mode === "unique";
    if(protocole.repetitions !== null) repetitions.value = protocole.repetitions;
  }

  function mesureCourante(){
    if(etat.secondeDebut === null || etat.secondeFin === null) return null;
    const competence = competenceChoisie();
    if(!competence) return null;
    const mode = modeChoisi();
    const repetitions = mode === "rafale" ? Number($("repetitions").value) : null;
    if(!window.ChronoCalcul.protocoleValide({
      gameId:competence.gameId, mode:mode, repetitions:repetitions
    })){
      throw new Error(
        "Protocole attendu : rafale avec un entier >= 2 ; unique avec reps:null."
      );
    }
    const fps = window.ChronoCalcul.fpsPour(etat.dureeImage, etat.cadence);
    if(!Number.isFinite(fps) || fps < 10 || fps > 240){
      throw new Error("La cadence calculée doit être comprise entre 10 et 240 img/s.");
    }
    const bornes = { secondeDebut:etat.secondeDebut, secondeFin:etat.secondeFin };
    const secondes = mode === "rafale"
      ? window.ChronoCalcul.dureeRafale({
          secondeDebut:bornes.secondeDebut,
          secondeFin:bornes.secondeFin,
          repetitions:repetitions
        })
      : window.ChronoCalcul.dureeUnique(bornes);
    if(!(secondes > 0 && secondes <= 30)){
      throw new Error("La durée doit être supérieure à 0 et ne pas dépasser 30 s.");
    }
    return {
      gameId:competence.gameId,
      heros:$("heros").value,
      arme:competence.weaponType,
      secondes:secondes,
      mode:mode,
      repetitions:repetitions,
      fps:fps
    };
  }

  function tempsCourant(){
    return etat.mediaTime !== null ? etat.mediaTime : video.currentTime;
  }

  function afficher(){
    const t = tempsCourant();
    $("secondeCourante").textContent = t.toFixed(3);
    $("imageCourante").textContent = etat.dureeImage
      ? String(Math.round(t / etat.dureeImage))
      : String(Math.round(t * etat.cadence));
    const fps = window.ChronoCalcul.fpsPour(etat.dureeImage, etat.cadence);
    const lisible = window.ChronoCalcul.cadenceAffichee(fps);
    $("cadence").textContent = etat.dureeImage
      ? lisible + " img/s"
      : lisible + " img/s (repli)";
    $("sortieDebut").textContent =
      etat.secondeDebut === null ? "—" : etat.secondeDebut.toFixed(3);
    $("sortieFin").textContent =
      etat.secondeFin === null ? "—" : etat.secondeFin.toFixed(3);
    let duree = "—";
    try{
      const mesure = mesureCourante();
      if(mesure) duree = String(mesure.secondes);
    }catch(erreur){
      duree = erreur.message;
    }
    $("sortieDuree").textContent = duree;
  }

  function remplir(select, entrees){
    select.innerHTML = "";
    entrees.forEach(entree => {
      const option = document.createElement("option");
      option.value = entree.valeur;
      option.textContent = entree.libelle;
      select.append(option);
    });
  }

  function majCompetences(){
    const nomHeros = $("heros").value;
    const arme = $("arme").value;
    remplir($("competence"), competencesDe(nomHeros, arme).map(competence => ({
      valeur:competence.gameId,
      libelle:etat.mesurees.has(competence.gameId)
        ? libelleDe(competence) + " ✓"
        : libelleDe(competence)
    })));
    majDetail();
  }

  function majArmes(){
    const nomHeros = $("heros").value;
    remplir($("arme"), armesDe(nomHeros).map(arme => ({
      valeur:arme, libelle:ARMES[arme] || arme
    })));
    majCompetences();
  }

  function majDetail(){
    const competence = competenceChoisie();
    const detail = $("detail");
    if(!competence){ detail.textContent = ""; afficher(); return; }

    const protocole = window.ChronoCalcul.protocolePour(competence.gameId);
    if(protocole.mode === "rafale"){
      const coups = Array.isArray(competence.repartition)
        ? competence.repartition.length : 0;
      detail.textContent = (coups ? "Enchaînement de " + coups + " coups. " : "")
        + "En rafale, compte des cycles entiers : marque le premier coup,"
        + " laisse tourner dix cycles, puis marque le premier coup du onzième.";
    }else{
      detail.textContent = "Une seule fois : mesure un lancement de cette compétence."
        + (competence.recharge ? " Sa recharge est de " + competence.recharge + " s." : "");
    }

    if(etat.mesurees.has(competence.gameId)){
      detail.textContent += " Déjà mesurée : ton envoi sera proposé comme correction.";
    }
    synchroniserProtocole();
    afficher();
  }

  async function chargerAvancement(){
    try{
      const reponse = await fetch("../data/animations-mesurees.json");
      const contenu = await reponse.json();
      etat.mesurees = new Set(Object.keys(contenu.animations || {}));
    }catch(erreur){
      etat.mesurees = new Set();
    }
    let total = 0;
    let faits = 0;
    tousLesHeros().forEach(nom => mesurablesDe(nom).forEach(competence => {
      total += 1;
      if(etat.mesurees.has(competence.gameId)) faits += 1;
    }));
    $("avancement").innerHTML =
      "<b>" + faits + " / " + total + "</b> animations mesurées";
    majCompetences();
  }

  /* Un pas d'image est une recherche, avec la duree REELLE d'une image.

     Viser la frontiere d'une image tombe une fois sur deux du mauvais cote.
     On vise donc son MILIEU : l'image n occupe [T + n*d, T + (n+1)*d), son
     milieu est a T + (n + 0,5)*d. La formule vaut dans les deux sens, +1
     donnant l'image suivante et -1 la precedente.

     C'est la cadence qui manquait, pas la methode : supposer 60 img/s sur une
     capture a 30 faisait sauter d'une demi-image, d'ou une avance qui ne
     marchait qu'une fois sur deux. */
  function deplacer(images){
    video.pause();
    const pas = etat.dureeImage || (1 / etat.cadence);
    const vise = Math.max(0, tempsCourant() + (images + 0.5) * pas);
    etat.viseeRecul = vise;
    video.currentTime = vise;
  }

  /* Mesurer la cadence sans rien demander a personne.

     Elle ne se lit que pendant une lecture. Quelqu'un qui avance image par
     image sans jamais lire ne la mesurait jamais, et l'outil restait sur son
     hypothese de 60 img/s. On lit donc en sourdine des le chargement, juste
     le temps que la fenetre de mesure se remplisse, puis on revient au debut. */
  function mesurerCadence(){
    if(typeof video.requestVideoFrameCallback !== "function") return;
    const muetAvant = video.muted;
    video.muted = true;
    const limite = performance.now() + 3000;
    const rendre = () => {
      video.pause();
      video.muted = muetAvant;
      video.currentTime = 0;
      afficher();
    };
    const surveiller = () => {
      if(etat.dureeImage || performance.now() > limite || video.ended){
        rendre();
        return;
      }
      requestAnimationFrame(surveiller);
    };
    const lecture = video.play();
    if(lecture && typeof lecture.catch === "function"){
      lecture.catch(() => { video.muted = muetAvant; });
    }
    requestAnimationFrame(surveiller);
  }

  /* Le navigateur annonce chaque image affichee avec son temps exact ET son
     numero. On ne compare donc plus deux images voisines : leur ecart tremble
     de quelques centiemes de milliseconde, ce qui suffisait a afficher 29.999
     pour un fichier a 30 puis 30.03 l'image d'apres.

     On garde une ancre, et la cadence se lit sur la distance parcourue depuis
     elle. Le numero d'image rend cette division exacte meme si un rappel a
     saute des images : elles restent comptees. */
  function suivreImages(){
    if(typeof video.requestVideoFrameCallback !== "function") return;
    // Un second appel doublerait la boucle, et les deux se voleraient l'ancre.
    if(etat.suiviActif) return;
    etat.suiviActif = true;
    video.requestVideoFrameCallback(function surImage(_, infos){
      etat.mediaTime = infos.mediaTime;
      const images = infos.presentedFrames;
      if(video.paused || typeof images !== "number"){
        etat.ancre = null;
      }else if(!etat.ancre){
        etat.ancre = { tempsDebut:infos.mediaTime, imagesDebut:images };
      }else{
        const duree = window.ChronoCalcul.dureeImageMesuree({
          tempsDebut:etat.ancre.tempsDebut,
          imagesDebut:etat.ancre.imagesDebut,
          tempsFin:infos.mediaTime,
          imagesFin:images
        });
        const ecoulees = images - etat.ancre.imagesDebut;
        /* Duree nulle : une recherche a fait bondir le temps sans derouler les
           images. La fenetre ne veut plus rien dire, on repart d'ici. */
        if(!duree || ecoulees >= FENETRE_MAX){
          etat.ancre = { tempsDebut:infos.mediaTime, imagesDebut:images };
        }else if(ecoulees >= FENETRE){
          etat.dureeImage = duree;
        }
      }
      afficher();
      video.requestVideoFrameCallback(surImage);
    });
  }

  $("fichierVideo").addEventListener("change", evenement => {
    const fichier = evenement.target.files && evenement.target.files[0];
    if(fichier){
      etat.mediaTime = null;
      etat.dureeImage = 0;
      etat.ancre = null;
      video.src = URL.createObjectURL(fichier);
      suivreImages();
      video.addEventListener("loadeddata", mesurerCadence, { once:true });
    }
  });

  /* Apres une recherche, comparer ou l'on voulait aller et ou l'on a atterri.
     Un enregistrement d'ecran n'a qu'une image-cle toutes les quatre secondes
     environ — 128 images sur une capture a 30 img/s. Le decodeur ne peut donc
     pas toujours servir l'image demandee et recule jusqu'a la cle. Le dire
     franchement vaut mieux que de laisser croire a un outil defaillant. */
  video.addEventListener("seeked", () => {
    const pas = etat.dureeImage || (1 / etat.cadence);
    if(etat.viseeRecul !== null && pas){
      const ecart = Math.abs(tempsCourant() - etat.viseeRecul);
      if(ecart > pas * 2) $("alerte").hidden = false;
      etat.viseeRecul = null;
    }
    afficher();
  });
  video.addEventListener("timeupdate", afficher);

  document.addEventListener("keydown", evenement => {
    if(evenement.key !== "ArrowLeft" && evenement.key !== "ArrowRight") return;
    const cible = evenement.target;
    /* Les fleches servent a naviguer dans une liste deroulante : on ne les
       detourne pas quand le focus est sur un champ. */
    if(cible && /^(SELECT|INPUT|TEXTAREA)$/.test(cible.tagName)) return;
    evenement.preventDefault();
    const pas = evenement.shiftKey ? 10 : 1;
    deplacer(evenement.key === "ArrowRight" ? pas : -pas);
  });

  $("marquerDebut").addEventListener("click", () => {
    etat.secondeDebut = tempsCourant();
    afficher();
  });
  $("marquerFin").addEventListener("click", () => {
    etat.secondeFin = tempsCourant();
    afficher();
  });
  $("heros").addEventListener("change", majArmes);
  $("arme").addEventListener("change", majCompetences);
  $("competence").addEventListener("change", majDetail);
  $("repetitions").addEventListener("input", afficher);
  Array.from(document.querySelectorAll("input[name=mode]")).forEach(bouton => {
    bouton.addEventListener("change", afficher);
  });

  remplir($("heros"), tousLesHeros().map(nom => ({ valeur:nom, libelle:nom })));
  majArmes();
  chargerAvancement();

  /* Meme contrat que les stores du site : `sb` vaut null sans configuration,
     et l'appelant le teste. La page reste alors utilisable pour mesurer,
     seul l'envoi est indisponible. */
  const sb = window.supabase && window.SB_URL && window.SB_KEY
    ? window.supabase.createClient(window.SB_URL, window.SB_KEY)
    : null;
  let envoiEnCours = false;

  async function envoyer(){
    if(envoiEnCours) return;
    const retour = $("retourEnvoi");
    if(!sb){ retour.textContent = "Connexion au registre indisponible."; return; }

    let mesure;
    try{
      mesure = mesureCourante();
    }catch(erreur){
      retour.textContent = erreur.message;
      return;
    }
    if(!mesure){ retour.textContent = "Marque d'abord un début et une fin."; return; }

    envoiEnCours = true;
    $("envoyer").disabled = true;
    try{
      const reponseUtilisateur = await sb.auth.getUser();
      const utilisateur = reponseUtilisateur.data && reponseUtilisateur.data.user;
      if(!utilisateur){
        retour.textContent = "Connecte-toi sur le site avant d'envoyer.";
        return;
      }

      const profil = await sb.from("profiles")
        .select("pseudo").eq("id", utilisateur.id).maybeSingle();

      const { error } = await sb.from("animation_measures").insert({
        owner:utilisateur.id,
        pseudo:(profil.data && profil.data.pseudo) || null,
        game_id:mesure.gameId,
        seconds:mesure.secondes,
        mode:mesure.mode,
        reps:mesure.repetitions,
        fps:mesure.fps
      });
      retour.textContent = error
        ? "L'envoi a échoué : " + error.message
        : "Mesure envoyée, en attente de validation humaine.";
    }catch(erreur){
      retour.textContent = "L'envoi a échoué : " + erreur.message;
    }finally{
      envoiEnCours = false;
      $("envoyer").disabled = false;
    }
  }

  $("envoyer").addEventListener("click", envoyer);

  window.ChronoPage = { mesureCourante, etat, chargerAvancement };
})();
