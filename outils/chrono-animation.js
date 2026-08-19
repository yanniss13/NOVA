"use strict";

/* La page de chronometrage.

   La cadence est fixee une fois et sert uniquement a afficher un numero
   d'image lisible et a calculer le pas des fleches. Le calcul de duree, lui,
   n'utilise que currentTime : il reste juste meme si la cadence declaree ne
   correspond pas a celle de l'enregistrement. */

(function(){
  const CADENCE = 60;

  const video = document.getElementById("video");
  const etat = {
    secondeDebut:null, secondeFin:null, cadence:CADENCE, mesurees:new Set()
  };

  function tousLesHeros(){
    return Object.keys(window.SEVEN_DS_COMPETENCES || {}).sort();
  }

  function competencesDe(nomHeros){
    return (window.SEVEN_DS_COMPETENCES || {})[nomHeros] || [];
  }

  /* Les cinq libelles du jeu, dans l'ordre ou un joueur enchaine ses touches.
     Les identifiants internes (skill_rmb_ready, skill_e_1...) ne veulent rien
     dire pour un membre : il choisit une competence, pas un slot. */
  const ORDRE = ["NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL"];
  const LIBELLES = {
    NORMAL:"Attaque normale",
    NORMAL_SKILL:"Compétence normale",
    ACTIVE_THIRD:"Attaque spéciale",
    ULTIMATE:"Attaque ultime",
    TAG_SKILL:"Compétence de relève"
  };

  function categorieDe(nomHeros, slot){
    const trouvee = competencesDe(nomHeros).find(competence =>
      competence.gameId
      && window.ChronoCalcul.slotDeGameId(competence.gameId) === slot);
    return trouvee ? trouvee.categorie : null;
  }

  /* 23 heros sur 25 ont deux emplacements dans une meme categorie : le clic
     droit simple et le clic droit charge sont deux animations distinctes. Sans
     ce mot, deux lignes identiques designeraient des mesures differentes. */
  function nuance(slot){
    if(slot.endsWith("_ready")) return " chargée";
    if(slot.includes("_enchant")) return " enchantée";
    return "";
  }

  function slotsDe(nomHeros){
    const bruts = [...new Set(
      competencesDe(nomHeros)
        .filter(competence => competence.gameId)
        .map(competence => window.ChronoCalcul.slotDeGameId(competence.gameId))
    )];
    bruts.sort((a, b) => {
      const rang = ORDRE.indexOf(categorieDe(nomHeros, a))
        - ORDRE.indexOf(categorieDe(nomHeros, b));
      return rang !== 0 ? rang : a.localeCompare(b);
    });
    const vus = {};
    return bruts.map(slot => {
      const categorie = categorieDe(nomHeros, slot);
      let libelle = (LIBELLES[categorie] || categorie) + nuance(slot);
      vus[libelle] = (vus[libelle] || 0) + 1;
      /* Dernier recours pour les variantes dont j'ignore le sens (_1, _a) :
         mieux vaut un numero qu'un identifiant technique ou un faux nom. */
      if(vus[libelle] > 1) libelle += " (" + vus[libelle] + ")";
      return { slot:slot, libelle:libelle };
    });
  }

  function gameIdsDe(nomHeros, slot){
    return competencesDe(nomHeros)
      .filter(competence => competence.gameId
        && window.ChronoCalcul.slotDeGameId(competence.gameId) === slot)
      .map(competence => competence.gameId);
  }

  function modeChoisi(){
    const coche = document.querySelector("input[name=mode]:checked");
    return coche ? coche.value : "rafale";
  }

  function mesureCourante(){
    if(etat.secondeDebut === null || etat.secondeFin === null) return null;
    const nomHeros = document.getElementById("heros").value;
    const slot = document.getElementById("slot").value;
    const repetitions = Number(document.getElementById("repetitions").value);
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
      heros:nomHeros,
      slot:slot,
      secondes:secondes,
      mode:mode,
      repetitions:mode === "rafale" ? repetitions : null,
      gameIds:gameIdsDe(nomHeros, slot)
    };
  }

  function afficher(){
    document.getElementById("secondeCourante").textContent =
      video.currentTime.toFixed(3);
    document.getElementById("imageCourante").textContent =
      String(Math.round(video.currentTime * etat.cadence));
    document.getElementById("sortieDebut").textContent =
      etat.secondeDebut === null ? "—" : etat.secondeDebut.toFixed(3);
    document.getElementById("sortieFin").textContent =
      etat.secondeFin === null ? "—" : etat.secondeFin.toFixed(3);
    let duree = "—";
    try{
      const mesure = mesureCourante();
      if(mesure) duree = String(mesure.secondes);
    }catch(erreur){
      duree = erreur.message;
    }
    document.getElementById("sortieDuree").textContent = duree;
  }

  function majGameIdsVises(){
    const nomHeros = document.getElementById("heros").value;
    const slot = document.getElementById("slot").value;
    document.getElementById("gameIdsVises").textContent =
      "Cette mesure renseignera : " + gameIdsDe(nomHeros, slot).join(", ");
    afficher();
  }

  /* L'avancement partage. Sans lui, deux membres mesurent le meme heros le
     meme soir sans le savoir : c'est le seul vrai risque d'une collecte a
     plusieurs, la saisie elle-meme ne pose pas de probleme. */
  function slotDejaMesure(nomHeros, slot){
    const cibles = gameIdsDe(nomHeros, slot);
    return cibles.length > 0 && cibles.every(id => etat.mesurees.has(id));
  }

  function remplirSlots(){
    const select = document.getElementById("slot");
    const nomHeros = document.getElementById("heros").value;
    select.innerHTML = "";
    slotsDe(nomHeros).forEach(entree => {
      const option = document.createElement("option");
      option.value = entree.slot;
      option.textContent = slotDejaMesure(nomHeros, entree.slot)
        ? entree.libelle + " ✓"
        : entree.libelle;
      select.append(option);
    });
    majGameIdsVises();
  }

  async function chargerAvancement(){
    try{
      const reponse = await fetch("../data/animations-mesurees.json");
      const contenu = await reponse.json();
      etat.mesurees = new Set(Object.keys(contenu.animations || {}));
    }catch(erreur){
      etat.mesurees = new Set();
    }
    let faits = 0;
    let total = 0;
    tousLesHeros().forEach(nom => slotsDe(nom).forEach(entree => {
      total += 1;
      if(slotDejaMesure(nom, entree.slot)) faits += 1;
    }));
    document.getElementById("avancement").textContent =
      "Avancement : " + faits + " / " + total + " animations mesurées.";
    remplirSlots();
  }

  function deplacer(images){
    video.pause();
    video.currentTime = Math.max(0, video.currentTime + images / etat.cadence);
  }

  document.getElementById("fichierVideo").addEventListener("change", evenement => {
    const fichier = evenement.target.files && evenement.target.files[0];
    if(fichier) video.src = URL.createObjectURL(fichier);
  });

  video.addEventListener("seeked", afficher);
  video.addEventListener("timeupdate", afficher);

  document.addEventListener("keydown", evenement => {
    if(evenement.key !== "ArrowLeft" && evenement.key !== "ArrowRight") return;
    evenement.preventDefault();
    const pas = evenement.shiftKey ? 10 : 1;
    deplacer(evenement.key === "ArrowRight" ? pas : -pas);
  });

  document.getElementById("marquerDebut").addEventListener("click", () => {
    etat.secondeDebut = video.currentTime;
    afficher();
  });
  document.getElementById("marquerFin").addEventListener("click", () => {
    etat.secondeFin = video.currentTime;
    afficher();
  });
  document.getElementById("heros").addEventListener("change", remplirSlots);
  document.getElementById("slot").addEventListener("change", majGameIdsVises);
  document.getElementById("repetitions").addEventListener("input", afficher);
  Array.from(document.querySelectorAll("input[name=mode]")).forEach(bouton => {
    bouton.addEventListener("change", afficher);
  });

  const selectHeros = document.getElementById("heros");
  tousLesHeros().forEach(nom => {
    const option = document.createElement("option");
    option.value = nom;
    option.textContent = nom;
    selectHeros.append(option);
  });
  remplirSlots();
  chargerAvancement();

  /* Le meme contrat que les stores du site : `sb` vaut null sans
     configuration, et tout appelant le teste avant usage. La page reste alors
     utilisable pour mesurer, seul l'envoi est indisponible. */
  const sb = window.supabase && window.SB_URL && window.SB_KEY
    ? window.supabase.createClient(window.SB_URL, window.SB_KEY)
    : null;

  async function envoyer(){
    const retour = document.getElementById("retourEnvoi");
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
      hero:mesure.heros,
      slot:mesure.slot,
      seconds:mesure.secondes,
      mode:mesure.mode,
      reps:mesure.repetitions,
      fps:etat.cadence
    });
    retour.textContent = error
      ? "L'envoi a échoué : " + error.message
      : "Mesure envoyée, merci.";
  }

  document.getElementById("envoyer").addEventListener("click", envoyer);

  window.ChronoPage = { mesureCourante, etat, chargerAvancement };
})();
