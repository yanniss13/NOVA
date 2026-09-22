/* Saisie, correction et suppression d'une run d'entraînement.

   Le membre qui saisit est coché d'office et ne peut pas se décocher : la
   RLS refuserait l'écriture. Pour chaque participant, on ne propose que SES
   équipes ; le serveur vérifie de toute façon qu'elle lui appartient, et en
   fige l'instantané lui-même.

   Rien n'est affiché comme enregistré avant la réponse de Supabase. */

import { EntrainementStore } from "../donnees/entrainement-store.js";
import { Store } from "../donnees/equipes-store.js";
import { refreshRosterProfiles } from "../donnees/roster-profils.js";
import { sessionCourante } from "../etat/session.js";
import {
  ENTRAINEMENT_MAX_PARTICIPANTS, ENTRAINEMENT_NOTE_MAX,
  dateParisEntrainement, validerSaisieEntrainement
} from "../metier/entrainement-boss.js";
import { $, el } from "../noyau/dom.js";
import { ModalStack } from "./modal-stack.js";
import { toast } from "./toast.js";

  const MESSAGES_ENTRAINEMENT = {
    PARTICIPANTS_VIDES:"Choisis au moins un participant.",
    TROP_DE_PARTICIPANTS:"Cinq participants au maximum.",
    AUTEUR_ABSENT:"Tu dois faire partie de la run.",
    PARTICIPANT_EN_DOUBLE:"Un participant apparaît deux fois.",
    SCORE_INVALIDE:"Le score doit être un nombre entier supérieur à zéro.",
    NOTE_TROP_LONGUE:"La note dépasse 1000 caractères.",
    DATE_INVALIDE:"La date est invalide.",
    DATE_FUTURE:"La date ne peut pas être dans le futur.",
    TRAINING_FUTURE_DATE:"La date ne peut pas être dans le futur.",
    TRAINING_TEAM_NOT_OWNED:"Une des équipes n’appartient plus à son membre : recharge la page.",
    TRAINING_NOT_A_MEMBER:"Un des participants n’est pas membre de la confrérie."
  };

  const modaleEntrainement = { run:null, apres:null, profils:[], equipes:[], choix:{} };

  function messageEntrainement(erreur){
    const code = String(erreur && (erreur.message || erreur) || "");
    if(code.includes("TRAINING_CONFLICT")){
      const pseudo = erreur && erreur.pseudo;
      return pseudo
        ? "Cette run a été modifiée par "+pseudo+" entre-temps : recharge-la."
        : "Cette run a été modifiée entre-temps : recharge-la.";
    }
    const connu = Object.keys(MESSAGES_ENTRAINEMENT).find(cle => code.includes(cle));
    return connu ? MESSAGES_ENTRAINEMENT[connu] : "Enregistrement impossible. Réessaie.";
  }

  function participantsCochesEntrainement(){
    return [...document.querySelectorAll("#trainingMembers input[data-member-id]:checked")]
      .map(caseACocher => caseACocher.dataset.memberId);
  }

  function profilsAffichesEntrainement(){
    const profils = modaleEntrainement.profils.slice();
    const participants = modaleEntrainement.run && modaleEntrainement.run.participants || [];
    participants.forEach(id => {
      if(profils.some(profil => profil.id === id)) return;
      const entree = modaleEntrainement.run.equipes[id] || {};
      profils.push({ id, pseudo:entree.pseudo || "Ancien membre" });
    });
    return profils;
  }

  function profilEntrainement(id){
    return profilsAffichesEntrainement().find(profil => profil.id === id) || { pseudo:"Membre" };
  }

  function dessinerEquipesEntrainement(){
    const boite = $("#trainingTeams");
    boite.replaceChildren();
    participantsCochesEntrainement().forEach(id => {
      const profil = profilEntrainement(id);
      const select = el("select",{ id:"trainingTeam-"+id, dataset:{teamFor:id} },[
        el("option",{ value:"", text:"Équipe non renseignée" })
      ]);
      modaleEntrainement.equipes.filter(t => t.owner === id).forEach(t => {
        select.appendChild(el("option",{ value:t.id, text:t.name || "Équipe sans nom" }));
      });
      select.value = modaleEntrainement.choix[id] || "";
      modaleEntrainement.choix[id] = select.value;
      select.addEventListener("change", () => { modaleEntrainement.choix[id] = select.value; });
      boite.appendChild(el("div",{class:"training-team-field"},[
        el("label",{ for:"trainingTeam-"+id, text:"Équipe de "+profil.pseudo }),
        select
      ]));
    });
  }

  function dessinerMembresEntrainement(){
    const moi = sessionCourante.user.id;
    const coches = new Set(modaleEntrainement.run ? modaleEntrainement.run.participants : [moi]);
    coches.add(moi);
    const boite = $("#trainingMembers");
    boite.replaceChildren();
    profilsAffichesEntrainement().forEach(profil => {
      const caseACocher = el("input",{ type:"checkbox", id:"trainingMember-"+profil.id,
        dataset:{memberId:profil.id} });
      caseACocher.checked = coches.has(profil.id);
      if(profil.id === moi) caseACocher.disabled = true;
      caseACocher.addEventListener("change", () => {
        if(participantsCochesEntrainement().length > ENTRAINEMENT_MAX_PARTICIPANTS){
          caseACocher.checked = false;
          $("#trainingError").textContent = MESSAGES_ENTRAINEMENT.TROP_DE_PARTICIPANTS;
          return;
        }
        dessinerEquipesEntrainement();
      });
      boite.appendChild(el("label",{ class:"training-member", for:"trainingMember-"+profil.id },[
        caseACocher, el("span",{ text:profil.pseudo })
      ]));
    });
  }

  function mettreAJourCompteurEntrainement(){
    $("#trainingCount").textContent = $("#trainingNote").value.length+"/"+ENTRAINEMENT_NOTE_MAX;
  }

  async function enregistrerEntrainement(){
    const bouton = $("#trainingSubmit");
    const aujourdhui = dateParisEntrainement();
    const verdict = validerSaisieEntrainement({
      auteurId:sessionCourante.user.id,
      participants:participantsCochesEntrainement(),
      score:$("#trainingScore").value,
      note:$("#trainingNote").value,
      playedOn:$("#trainingDate").value,
      aujourdhui
    });
    if(!verdict.ok){
      $("#trainingError").textContent = MESSAGES_ENTRAINEMENT[verdict.erreur];
      return;
    }
    const equipes = {};
    verdict.valeur.participants.forEach(id => {
      equipes[id] = { teamId:modaleEntrainement.choix[id] || null };
    });
    const saisie = Object.assign({}, verdict.valeur, { equipes });
    bouton.disabled = true;
    try{
      if(modaleEntrainement.run){
        await EntrainementStore.update(modaleEntrainement.run.id, modaleEntrainement.run.updatedAt, saisie);
      }else{
        await EntrainementStore.create(saisie);
      }
      ModalStack.close($("#trainingOverlay"));
      toast(modaleEntrainement.run ? "Run corrigée." : "Run enregistrée.");
      await modaleEntrainement.apres();
    }catch(erreur){
      $("#trainingError").textContent = messageEntrainement(erreur);
      if(String(erreur && erreur.message) === "TRAINING_CONFLICT") await modaleEntrainement.apres();
    }finally{
      bouton.disabled = false;
    }
  }

  async function supprimerEntrainement(){
    if(!modaleEntrainement.run) return;
    if(!window.confirm("Supprimer définitivement cette run d’entraînement ?")) return;
    try{
      await EntrainementStore.remove(modaleEntrainement.run.id);
      ModalStack.close($("#trainingOverlay"));
      toast("Run supprimée.");
      await modaleEntrainement.apres();
    }catch(erreur){
      $("#trainingError").textContent = messageEntrainement(erreur);
    }
  }

  let modaleEntrainementBranchee = false;
  let demandeEntrainement = 0;
  function brancherModaleEntrainement(){
    if(modaleEntrainementBranchee) return;
    modaleEntrainementBranchee = true;
    $("#trainingClose").addEventListener("click", () => ModalStack.close($("#trainingOverlay")));
    $("#trainingSubmit").addEventListener("click", () => void enregistrerEntrainement());
    $("#trainingDelete").addEventListener("click", () => void supprimerEntrainement());
    $("#trainingNote").addEventListener("input", mettreAJourCompteurEntrainement);
  }

  async function ouvrirSaisieEntrainement(run, options){
    brancherModaleEntrainement();
    const demande = ++demandeEntrainement;
    try{
      const [profils] = await Promise.all([refreshRosterProfiles(), Store.refresh()]);
      if(demande !== demandeEntrainement) return;
      modaleEntrainement.run = run || null;
      modaleEntrainement.apres = (options && options.apres) || (async () => {});
      modaleEntrainement.profils = profils;
      modaleEntrainement.equipes = Store.all();
    }catch(erreur){
      if(demande !== demandeEntrainement) return;
      toast("Membres ou équipes indisponibles hors ligne.", true);
      return;
    }
    modaleEntrainement.choix = {};
    if(run){
      Object.entries(run.equipes).forEach(([id, entree]) => {
        modaleEntrainement.choix[id] = entree.teamId || "";
      });
    }
    $("#trainingTitle").textContent = run ? "Corriger la run d’entraînement" : "Enregistrer une run d’entraînement";
    $("#trainingDate").value = run ? run.playedOn : dateParisEntrainement();
    $("#trainingDate").max = dateParisEntrainement();
    $("#trainingScore").value = run ? run.score : "";
    $("#trainingNote").value = run ? run.note : "";
    $("#trainingError").textContent = "";
    $("#trainingDelete").hidden = !run;
    mettreAJourCompteurEntrainement();
    dessinerMembresEntrainement();
    dessinerEquipesEntrainement();
    const overlay = $("#trainingOverlay");
    ModalStack.open(overlay, "#trainingDate", () => ModalStack.close(overlay));
  }

export { ouvrirSaisieEntrainement };
