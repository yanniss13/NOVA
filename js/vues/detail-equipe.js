/* La modale de detail d'une equipe : l'equipement complet, heros par heros.

   Elle ne dessine rien elle-meme — chaque heros passe par la fiche commune de
   vues/fiche-heros.js. Son travail est de rassembler le contexte que la fiche
   attend : a qui appartient l'equipe, et quels builds le visiteur possede
   deja, pour que le bouton d'import sache dire « ajouter » ou « mettre a jour ».

   `ownEntries` est lu une seule fois a l'ouverture, pas par heros : la modale
   affiche jusqu'a huit fiches et le roster ne bouge pas entre-temps.

   Le branchement des boutons de fermeture se fait au chargement du module,
   comme dans editeur-arme.js et picker.js : le balisage vient d'index.html,
   il existe donc avant que le module ne s'execute. */

import { $, el } from "../noyau/dom.js";
import { metaOf } from "../noyau/constantes.js";
import { canManageTeam, sessionCourante } from "../etat/session.js";
import { catalogueWikiPret, chargerCatalogueWiki } from "../donnees/catalogue-wiki.js";
import { Store } from "../donnees/equipes-store.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { equippedEnumOf, weaponFolderOf } from "../metier/armes.js";
import { calculateHeroStats } from "../metier/stats-calcul.js";
import { termesDEquipe } from "../metier/potentiels-equipe.js";
import { normaliserRotation } from "../metier/rotation-equipe.js";
import { ModalStack } from "./modal-stack.js";
import { heroDetail } from "./fiche-heros.js";
import { blocRotation } from "./rotation-equipe.js";
import { toast } from "./toast.js";

  /* L'element vient de l'ARME equipee, jamais du personnage. Piege documente
     dans AGENTS.md, et la raison pour laquelle un potentiel restreint a un
     element ne peut pas se decider a l'echelle de l'equipe. */
  function elementDuHerosDEquipe(hero){
    const meta = hero && hero.char ? metaOf(hero.char) : null;
    const equipee = equippedEnumOf(hero);
    const slot = meta && meta.weapons
      ? meta.weapons.find(w => w.weapon === equipee) : null;
    return slot && slot.element ? String(slot.element).toLowerCase() : null;
  }

  /* Une statistique d'un coequipier, ou null quand son build n'est pas
     calculable. `termesDEquipe` ecarte alors la ligne plutot que de servir un
     chiffre invente. */
  function statDeCoequipier(hero, code){
    const result = calculateHeroStats(hero);
    if(!result || (result.status !== "valid" && result.status !== "partial")){
      return null;
    }
    const total = result.totals.find(item => item.stat === code);
    return total && Number.isFinite(total.value) ? total.value : null;
  }

  /* CE QUE LES COEQUIPIERS DONNENT, heros par heros.

     Les porteurs sont montes UNE FOIS - chaque `calculateHeroStats` coute -
     puis relus pour chacun : seul `estLeHeros` change d'un heros a l'autre, et
     l'element avec lui. */
  function apportsDEquipe(heroes){
    const liste = Array.isArray(heroes) ? heroes.filter(Boolean) : [];
    const porteurs = liste.map(hero => ({
      hero,
      charId:hero.char,
      typeArme:weaponFolderOf(hero.weapon),
      palier:hero.potentiel ? hero.potentiel.tier : null,
      atk:statDeCoequipier(hero, "B_Atk"),
      def:statDeCoequipier(hero, "B_Def")
    }));
    return hero => termesDEquipe({
      element:elementDuHerosDEquipe(hero),
      porteurs:porteurs.map(porteur => Object.assign({}, porteur, {
        estLeHeros:porteur.hero === hero
      }))
    });
  }

  /* LE BLOC DE ROTATION.

     Il ne s'affiche PAS quand l'equipe n'en a pas et que le visiteur ne peut
     pas en poser : une section vide chez quelqu'un qui ne peut rien y faire
     n'est que du bruit.

     Le catalogue du wiki arrive a la demande — 230 Ko qu'un visiteur qui
     n'ouvre aucune equipe ne doit pas payer. Le bloc s'affiche donc d'abord en
     attente, puis se redessine une fois le catalogue la. */
  function phraseDeLaRotation(appuis, modifiable){
    if(appuis) return appuis + (appuis > 1 ? " appuis" : " appui") + " posés";
    return modifiable
      ? "Aucune rotation — compose la tienne"
      : "Aucune rotation posée";
  }

  /* LE LIEN vers la rotation, et rien de plus.

     La modale d'equipe porte deja quatre fiches, chacune avec une arme, cinq
     pieces d'armure et trois bijoux ; la rotation par-dessus la rendait
     illisible au telephone. Elle sort donc dans sa propre modale, et il ne
     reste ici qu'une rangee.

     Cette rangee ne demande RIEN au reseau : le nombre d'appuis se lit sur la
     rotation elle-meme. Les 230 Ko du catalogue ne partent qu'a l'ouverture de
     la rotation — ouvrir une equipe pour voir son equipement ne les paie
     plus. */
  function lienRotation(equipe){
    const appuis = normaliserRotation((equipe && equipe.rotation) || []).length;
    const modifiable = canManageTeam(equipe);
    if(!appuis && !modifiable) return null;
    const bouton = el("button",{
      class:"rota-lien", type:"button",
      onclick:()=>ouvrirRotation(equipe, bouton)
    },[
      el("span",{ class:"rota-lien-titre", text:"Rotation" }),
      el("span",{ class:"rota-lien-detail",
        text:phraseDeLaRotation(appuis, modifiable) }),
      el("span",{ class:"rota-lien-chevron", text:"›", "aria-hidden":"true" })
    ]);
    return el("section",{ class:"rota-entree" },[bouton]);
  }

  /* L'OUVERTURE. Le catalogue du wiki arrive a la demande — la modale
     s'affiche d'abord en attente, puis se remplit. */
  function ouvrirRotation(equipe, declencheur){
    const corps = $("#rotationBody");
    const titre = $("#rotationTitle");
    titre.textContent = equipe && equipe.name
      ? "Rotation — " + equipe.name
      : "Rotation";

    const dessiner = () => {
      corps.innerHTML = "";
      corps.appendChild(blocRotation(equipe, {
        modifiable:canManageTeam(equipe),
        surEnregistrement:suite => enregistrerRotation(equipe, suite)
      }));
    };

    corps.innerHTML = "";
    if(catalogueWikiPret()) dessiner();
    else {
      corps.appendChild(el("p",{ class:"calc-muette",
        text:"Chargement des compétences…" }));
      chargerCatalogueWiki().then(dessiner).catch(() => {
        corps.innerHTML = "";
        corps.appendChild(el("p",{ class:"calc-avertissement",
          text:"Les compétences n'ont pas pu être chargées." }));
      });
    }

    /* En refermant, la rangee de la modale d'equipe doit dire le nouveau
       compte : on la remplace sur place plutot que de redessiner la modale
       entiere, qui perdrait la position de lecture. */
    ModalStack.open($("#rotationOverlay"), "#rotationClose",
      fermerRotation, declencheur, ()=>{
        const remplacante = lienRotation(equipe);
        const ancienne = declencheur && declencheur.closest(".rota-entree");
        if(remplacante && ancienne && ancienne.parentElement){
          ancienne.parentElement.replaceChild(remplacante, ancienne);
        }
      });
  }

  /* L'ENREGISTREMENT. Une equipe de compte passe par Supabase, une equipe
     locale par le stockage du navigateur — `Store` connait deja la
     difference, cette vue n'a pas a la refaire.

     En cas d'echec, l'etat edite RESTE a l'ecran : on ne perd pas le travail
     du membre sur une coupure reseau. C'est pourquoi la promesse est rejetee
     plutot qu'avalee — le bloc redessine sans avancer sa reference. */
  function enregistrerRotation(equipe, rotation){
    equipe.rotation = rotation;
    if(sessionCourante.user){
      return Store.upsert(equipe)
        .then(()=>{ toast("Rotation enregistrée."); })
        .catch(()=>{
          toast("La rotation n'a pas pu être enregistrée.", true);
          throw new Error("ROTATION_NON_ENREGISTREE");
        });
    }
    const liste = Store.all();
    const index = liste.findIndex(item => item.id === equipe.id);
    if(index >= 0) liste[index] = equipe;
    Store.save(liste);
    toast("Rotation enregistrée.");
    return Promise.resolve(true);
  }

  function openTeamDetail(t){
    $("#teamTitle").textContent = t.name
      ? t.name + " — " + (t.pseudo || "Sans pseudo")
      : "Équipe — " + (t.pseudo || "Sans pseudo");
    const box = $("#teamDetail");
    box.innerHTML = "";
    const ownEntries = sessionCourante.user ? MemberRosterStore.all(sessionCourante.user.id) : [];
    const settings = {
      team:t,
      canImport:canManageTeam(t) && !!sessionCourante.user,
      hasBuild:(charId, type)=>{
        const entry = ownEntries.find(item => item.charId === charId);
        return !!entry && !!type
          && Object.prototype.hasOwnProperty.call(entry.builds, type);
      }
    };
    settings.termesEquipePour = apportsDEquipe(t.heroes || []);
    /* LA ROTATION D'ABORD, l'equipement ensuite.

       Elle etait en bas, apres quatre fiches de heros qui portent chacune une
       arme, cinq pieces d'armure et trois bijoux : sur un telephone, elle
       etait hors d'atteinte — le membre l'a signale ainsi, « la il est tout
       en bas de la modal, sur tel c'est pas pratique ».

       L'ordre est aussi le bon sur le fond : la rotation dit COMMENT l'equipe
       se joue, l'equipement dit avec quoi. On lit le resume avant le detail. */
    const rotation = lienRotation(t);
    if(rotation) box.appendChild(rotation);
    (t.heroes||[]).forEach(h=>box.appendChild(heroDetail(h, settings)));
    ModalStack.open($("#teamOverlay"), "#teamClose", closeTeamDetail);
  }
  function closeTeamDetail(){
    ModalStack.close($("#teamOverlay"));
  }
  /* La croix et le fond de la modale de rotation. `ModalStack` gere la pile et
     la touche Echap ; le clic, lui, se cable ici comme pour toute autre
     modale du site. */
  function fermerRotation(){
    ModalStack.close($("#rotationOverlay"));
  }
  $("#rotationClose").addEventListener("click", fermerRotation);
  $("#rotationOverlay").addEventListener("click", event => {
    if(event.target === $("#rotationOverlay")) fermerRotation();
  });

  $("#teamClose").addEventListener("click", closeTeamDetail);
  $("#teamOverlay").addEventListener("click", event => {
    if(event.target === $("#teamOverlay")) closeTeamDetail();
  });

export { openTeamDetail };
