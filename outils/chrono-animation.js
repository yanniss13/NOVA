"use strict";

/* La page de chronometrage.

   Une mesure vaut pour UN gameId : un heros, une arme, une competence.
   Meliodas a la hache et Meliodas a l'epee longue n'ont pas le meme moveset,
   leurs animations se mesurent donc separement.

   Les competences non chiffrables sont ecartees : sans pourcentage de degats,
   leur animation n'entre dans aucun calcul de DPS. Restent 335 mesures, le
   compte exact de docs/chronometrage-animations.md.

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
    secondeDebut:null, secondeFin:null, cadence:CADENCE, mesurees:new Set()
  };

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

  function mesureCourante(){
    if(etat.secondeDebut === null || etat.secondeFin === null) return null;
    const competence = competenceChoisie();
    if(!competence) return null;
    const repetitions = Number($("repetitions").value);
    const mode = modeChoisi();
    const bornes = { secondeDebut:etat.secondeDebut, secondeFin:etat.secondeFin };
    const secondes = mode === "rafale"
      ? window.ChronoCalcul.dureeRafale({
          secondeDebut:bornes.secondeDebut,
          secondeFin:bornes.secondeFin,
          repetitions:repetitions
        })
      : window.ChronoCalcul.dureeUnique(bornes);
    return {
      gameId:competence.gameId,
      heros:$("heros").value,
      arme:competence.weaponType,
      secondes:secondes,
      mode:mode,
      repetitions:mode === "rafale" ? repetitions : null
    };
  }

  function afficher(){
    $("secondeCourante").textContent = video.currentTime.toFixed(3);
    $("imageCourante").textContent =
      String(Math.round(video.currentTime * etat.cadence));
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

  /* Seules les auto-attaques s'enchainent : toutes les autres competences ont
     une recharge. La rafale ne concerne donc qu'elles, et comme une
     auto-attaque est un cycle de plusieurs coups, ce sont des cycles entiers
     qu'on compte, pas des coups. */
  function estAutoAttaque(gameId){
    return /jumpatk|normalatk/.test(gameId);
  }

  function majDetail(){
    const competence = competenceChoisie();
    const detail = $("detail");
    if(!competence){ detail.textContent = ""; afficher(); return; }

    if(estAutoAttaque(competence.gameId)){
      const coups = Array.isArray(competence.repartition)
        ? competence.repartition.length : 0;
      detail.textContent = (coups ? "Enchaînement de " + coups + " coups. " : "")
        + "En rafale, compte des cycles entiers : marque le premier coup,"
        + " laisse tourner dix cycles, puis marque le premier coup du onzième.";
    }else{
      detail.textContent = "Une seule fois : cette compétence a une recharge"
        + (competence.recharge ? " de " + competence.recharge + " s" : "")
        + ", elle ne s'enchaîne pas.";
    }

    if(etat.mesurees.has(competence.gameId)){
      detail.textContent += " Déjà mesurée : ta valeur remplacera l'ancienne.";
    }
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

  function deplacer(images){
    video.pause();
    video.currentTime = Math.max(0, video.currentTime + images / etat.cadence);
  }

  $("fichierVideo").addEventListener("change", evenement => {
    const fichier = evenement.target.files && evenement.target.files[0];
    if(fichier) video.src = URL.createObjectURL(fichier);
  });

  video.addEventListener("seeked", afficher);
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
    etat.secondeDebut = video.currentTime;
    afficher();
  });
  $("marquerFin").addEventListener("click", () => {
    etat.secondeFin = video.currentTime;
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

  async function envoyer(){
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
      fps:etat.cadence
    });
    retour.textContent = error
      ? "L'envoi a échoué : " + error.message
      : "Mesure envoyée, merci.";
  }

  $("envoyer").addEventListener("click", envoyer);

  window.ChronoPage = { mesureCourante, etat, chargerAvancement };
})();
