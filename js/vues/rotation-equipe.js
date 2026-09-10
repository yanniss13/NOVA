/* La rotation d'une equipe, a l'ecran.

   Un seul composant, deux modes : lecture pour qui consulte l'equipe d'un
   autre, edition pour son auteur. Deux composants auraient fini par diverger
   sur le rendu d'une case, qui est exactement ce qu'on veut identique.

   UNE CASE = UNE SERIE. Onze appuis d'affilee sur la meme competence font une
   case « x11 », pas onze icones : un mur d'icones identiques ne se lit pas, et
   la rotation existe pour etre lue d'un coup d'oeil. */

import { el } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import {
  PLAFOND_ROTATION, ajouterEtape, casesDeLaRotation, combinaisonsDeLEquipe,
  deplacerCase, normaliserRotation, paletteDeLEquipe, retirerLaCase, retirerUne
} from "../metier/rotation-equipe.js";

  /* `draggable="false"` SUR CHAQUE IMAGE, et ce n'est pas un detail de style.

     Une image est nativement glissable : commencer un glisser dessus declenche
     le glisser-deposer du navigateur, qui ANNULE le pointeur en cours. Le
     `pointercancel` arrive, `pointerup` ne vient jamais, et le reordonnancement
     mourait a son premier pixel — sans la moindre erreur en console. */
  function imageNonGlissable(props){
    return el("img", Object.assign({ draggable:"false" }, props));
  }

  /* Le portrait d'un heros, en medaillon. `charOf` rend null pour un
     personnage retire du catalogue : la case reste, sans image. */
  function medaillon(char){
    const fiche = char ? charOf(char) : null;
    const cadre = el("span",{ class:"rota-portrait" });
    if(fiche){
      cadre.appendChild(imageNonGlissable({
        src:fiche.file, alt:fiche.name, loading:"lazy"
      }));
    }
    return cadre;
  }

  function nomDuHeros(char){
    const fiche = char ? charOf(char) : null;
    return fiche ? fiche.name : "héros absent";
  }

  function iconeDeCompetence(competence){
    return competence && competence.icone
      ? imageNonGlissable({
          class:"rota-icone",
          src:"7ds-ui/skills/" + competence.icone,
          alt:competence.nomFr || "",
          loading:"lazy"
        })
      : el("span",{ class:"rota-icone rota-icone-absente", text:"?" });
  }

  /* Une case ORDINAIRE : le portrait du heros, l'icone de sa competence, et
     « xN » quand la serie en compte plusieurs.

     Le multiplicateur est ECRIT, jamais porte par la seule couleur. */
  function contenuCompetence(item){
    const enfants = [medaillon(item.char), iconeDeCompetence(item.competence)];
    if(item.fois > 1){
      enfants.push(el("span",{ class:"rota-fois", text:"×" + item.fois }));
    }
    return enfants;
  }

  /* Une case COMBINEE : les portraits des participants, LANCEUR EN PREMIER et
     plus grand. Elle ne doit pas se lire comme la competence d'un heros — le
     cadre la distingue, et le titre nomme le lanceur.

     La relation est orientee : la table porte « Ban lance, Tristan enchaine »
     et « Tristan lance, Ban enchaine » comme deux lignes distinctes. */
  function contenuCombine(item){
    const portraits = el("span",{ class:"rota-combine-portraits" },
      item.participants.map((part, rang) => {
        const cadre = medaillon(part.char);
        cadre.classList.add(rang === 0 ? "rota-lanceur" : "rota-partenaire");
        return cadre;
      })
    );
    const enfants = [portraits];
    if(item.fois > 1){
      enfants.push(el("span",{ class:"rota-fois", text:"×" + item.fois }));
    }
    return enfants;
  }

  function titreDeLaCase(item){
    const absente = item.orpheline ? " (absente de l'équipe)" : "";
    if(item.participants.length){
      const noms = item.participants.map(part => nomDuHeros(part.char));
      return "Combinaison — " + noms[0] + " lance, avec "
        + noms.slice(1).join(" et ") + absente;
    }
    const nom = item.competence ? item.competence.nomFr : "compétence inconnue";
    return nomDuHeros(item.char) + " — " + nom + absente;
  }

  /* Les commandes d'une case, en mode edition seulement.

     Les fleches sont la voie SURE : clavier, lecteur d'ecran, navigateurs
     tactiles capricieux. Le glisser plus bas est la voie naturelle. Aucune ne
     remplace l'autre.

     Le RETRAIT n'est pas ici : il est en pastille d'angle, voir
     `caseDeRotation`. Range dans cette rangee, il se lisait comme une
     troisieme fleche entre deux fleches. */
  function commandesDeLaCase(item, rang, total, actions){
    const bouton = (texte, titre, actif, gerer) => {
      const b = el("button",{
        class:"rota-cmd", type:"button", text:texte, title:titre,
        onclick:gerer
      });
      if(!actif) b.disabled = true;
      return b;
    };
    const commandes = [
      bouton("◀", "Déplacer vers la gauche", rang > 0,
        ()=>actions.deplacer(rang, rang - 1))
    ];
    /* Une case ORPHELINE se retire ENTIERE : reduire d'une occurrence une
       etape que l'equipe ne porte plus n'a aucun sens — on ne « garde » pas
       deux tiers d'une compétence absente. Elle n'a donc pas de « moins ». */
    if(!item.orpheline){
      commandes.push(bouton("−", "Une occurrence de moins", true,
        ()=>actions.retirerUne(rang)));
    }
    commandes.push(bouton("▶", "Déplacer vers la droite",
      rang < total - 1, ()=>actions.deplacer(rang, rang + 1)));
    return el("span",{ class:"rota-commandes" }, commandes);
  }

  /* LE GLISSER, en Pointer Events.

     Le glisser-deposer HTML5 ne marche pas au doigt : `dragstart` n'est jamais
     emis sur la plupart des navigateurs tactiles. Les Pointer Events couvrent
     souris, doigt et stylet d'une seule interface.

     Un appui qui ne BOUGE PAS n'est pas un glisser : sous le seuil, on laisse
     le clic passer, sinon la case ne repondrait plus a ses boutons. Six
     pixels, la distance sous laquelle un doigt pose ne se distingue pas d'un
     doigt qui glisse.

     La case visee se lit avec `elementFromPoint` plutot qu'en calculant des
     rectangles : les cases passent a la ligne, et une geometrie reconstruite
     se tromperait des le premier retour a la ligne. */
  const SEUIL_GLISSER = 6;

  function rendreDeplacable(li, rang, actions){
    let depart = null;
    let glisse = false;

    li.addEventListener("pointerdown", event => {
      /* Les commandes gardent leur geste : un appui sur « − » n'est pas le
         debut d'un glisser. */
      if(event.target.closest("button")) return;
      depart = { x:event.clientX, y:event.clientY };
      glisse = false;
      li.setPointerCapture(event.pointerId);
    });

    li.addEventListener("pointermove", event => {
      if(!depart) return;
      const ecart = Math.hypot(event.clientX - depart.x, event.clientY - depart.y);
      if(!glisse && ecart < SEUIL_GLISSER) return;
      glisse = true;
      li.classList.add("rota-case-glissee");
      /* PAS de preventDefault ici. Il paraissait utile — « empecher la modale
         de defiler sous le doigt » — et il cassait tout : annuler l'evenement
         par defaut d'un `pointermove` fait ANNULER le pointeur au navigateur,
         qui emet `pointercancel` et cesse d'envoyer moves et `pointerup`. Le
         glisser mourait donc a son premier pixel, sans erreur.

         Le defilement est deja coupe par `touch-action:none`, pose en CSS sur
         la case en mode edition. C'est la bonne couche pour ca. */
    });

    const terminer = event => {
      if(!depart) return;
      const partait = glisse;
      depart = null;
      glisse = false;
      li.classList.remove("rota-case-glissee");
      if(li.hasPointerCapture && li.hasPointerCapture(event.pointerId)){
        li.releasePointerCapture(event.pointerId);
      }
      if(!partait) return;
      const sous = document.elementFromPoint(event.clientX, event.clientY);
      const cible = sous && sous.closest(".rota-case");
      if(!cible || cible === li || !li.parentElement) return;
      /* On ne compte QUE les vraies cases : les releves deduites s'intercalent
         dans la liste a l'ecran, et un index pris sur tous les enfants
         viserait la mauvaise etape des la premiere. */
      const rangs = Array.from(li.parentElement.querySelectorAll(".rota-case"));
      actions.deplacer(rang, rangs.indexOf(cible));
    };

    li.addEventListener("pointerup", terminer);
    li.addEventListener("pointercancel", terminer);
  }

  function caseDeRotation(item, rang, total, actions){
    const classe = "rota-case"
      + (item.participants.length ? " rota-case-combine" : "")
      + (item.orpheline ? " rota-case-orpheline" : "");
    const li = el("li",{ class:classe, title:titreDeLaCase(item) },
      item.participants.length ? contenuCombine(item) : contenuCompetence(item));
    if(!actions) return li;
    /* Appui sur « + » = une occurrence de plus. Le geste le plus courant
       merite le bouton le plus direct.

       Une case ORPHELINE n'en recoit pas : personne ne veut une occurrence de
       plus d'une etape que l'equipe ne porte plus. */
    if(!item.orpheline){
      li.appendChild(el("button",{
        class:"rota-plus", type:"button", text:"+",
        title:"Une occurrence de plus",
        onclick:()=>actions.ajouter(item.etape)
      }));
    }
    /* LE RETRAIT DE LA CASE ENTIERE, sur CHAQUE case et non plus sur les
       seules orphelines.

       Il manquait, et le membre l'a dit ainsi : « je peux pas supprimer les
       competences que je mets pour ma rota ». Le « moins » repondait bien,
       mais il ne retire QU'UNE occurrence : une serie « x11 » demandait onze
       appuis, et rien a l'ecran ne disait qu'il en existait un douzieme.

       En pastille d'angle, opposee au « + » : le geste inverse du geste le
       plus courant se lit en face de lui, et il ne prend aucune largeur dans
       une rangee de cases qui doit rester dense. */
    li.appendChild(el("button",{
      class:"rota-retrait", type:"button", text:"✕",
      title:item.fois > 1
        ? "Retirer cette case et ses " + item.fois + " appuis"
        : "Retirer cette case",
      onclick:()=>actions.retirerLaCase(rang)
    }));
    li.appendChild(commandesDeLaCase(item, rang, total, actions));
    rendreDeplacable(li, rang, actions);
    return li;
  }

  /* LA RELEVE, DEDUITE DU CHANGEMENT DE HEROS.

     Elle ne fait pas partie de la rotation du membre : elle apparait parce
     que la case suivante appartient a quelqu'un d'autre. Elle ne porte donc
     AUCUNE commande — ni croix, ni fleches, ni glisser. On ne deplace pas une
     consequence, on deplace la cause.

     Elle ne porte pas non plus la classe `rota-case`, et ce n'est pas
     cosmetique : c'est ce qui la tient hors des index de deplacement. */
  function caseDeReleve(item){
    return el("li",{
      class:"rota-releve",
      title:"Relève — " + nomDuHeros(item.sortant) + " laisse la place à "
        + nomDuHeros(item.char)
        + (item.competence ? " : " + item.competence.nomFr : "")
    },[
      /* L'icone de releve d'abord — mais elle est GENERIQUE : le jeu donne le
         meme `Icon_TagSkill.webp` aux 78 competences de releve. Elle dit
         « ici on releve », rien de plus. C'est le PORTRAIT qui apprend
         quelque chose, donc c'est lui qui est grand ; le nom de la releve,
         lui, est dans l'infobulle avec les deux heros. */
      iconeDeCompetence(item.competence),
      medaillon(item.char)
    ]);
  }

  function suiteDesCases(items, actions){
    /* Le total sert aux fleches — « suis-je la derniere ? ». Il compte les
       cases POSEES, pas les releves deduites. */
    const posees = items.filter(item => !item.releve).length;
    return el("ol",{
      class:"rota-suite" + (actions ? " rota-suite-edition" : "")
    }, items.map(item => item.releve
      ? caseDeReleve(item)
      : caseDeRotation(item, item.serie, posees, actions)));
  }

  /* LA PALETTE : les quatre heros avec les competences de leur arme EQUIPEE,
     puis les combinaisons que cette equipe peut reellement executer.

     Une equipe qui n'en permet aucune le lit en une phrase, au lieu de se voir
     offrir un selecteur vide. */
  function ligneDeCombinaisons(titre, liste, actions){
    const ligne = el("div",{ class:"rota-palette-ligne" },[
      el("span",{ class:"rota-palette-nom", text:titre })
    ]);
    liste.forEach(combinaison => {
      const identifiants = [combinaison.lanceur].concat(combinaison.partenaires);
      const noms = identifiants.map(id => nomDuHeros(id.split("_")[0]));
      ligne.appendChild(el("button",{
        class:"rota-palette-bouton rota-palette-combine", type:"button",
        title:noms[0] + " lance, avec " + noms.slice(1).join(" et "),
        onclick:()=>actions.ajouter(combinaison.etape)
      }, identifiants.map((id, rang) => {
        const cadre = medaillon(id.split("_")[0]);
        cadre.classList.add(rang === 0 ? "rota-lanceur" : "rota-partenaire");
        return cadre;
      })));
    });
    return ligne;
  }

  function paletteDesCompetences(palette, combinaisons, actions){
    const bloc = el("div",{ class:"rota-palette" });
    palette.forEach(entree => {
      const ligne = el("div",{ class:"rota-palette-ligne" },[
        medaillon(entree.char),
        el("span",{ class:"rota-palette-nom", text:nomDuHeros(entree.char) })
      ]);
      entree.competences.forEach(competence => {
        ligne.appendChild(el("button",{
          class:"rota-palette-bouton", type:"button",
          title:nomDuHeros(entree.char) + " — "
            + (competence.nomFr || competence.gameId),
          onclick:()=>actions.ajouter(competence.gameId)
        },[iconeDeCompetence(competence)]));
      });
      bloc.appendChild(ligne);
    });

    /* UNE SEULE section, « Ultimes combines », et le titre est MESURE :
       les 24 competences de lancement du catalogue et les 24 de partenaire
       sont toutes de categorie ULTIMATE (verifie par
       tests/ultimes-combines-catalogue.test.js, hors ligne).

       Le piege etait le suffixe : l'ultime de Tristan s'appelle
       `tristan_sworddual_skill_q`, sa speciale `..._skill_rmb`, et
       `tristan_sworddual_skill_r` n'existe pas. Lire le suffixe comme une
       categorie a fait inventer deux fois une mecanique absente du jeu —
       des « speciales combinees », puis une touche par heros. Il n'y a qu'un
       ultime combine, declenche par une seule touche : R au clavier, R2 a la
       manette. */
    if(combinaisons.length){
      bloc.appendChild(
        ligneDeCombinaisons("Ultimes combinés", combinaisons, actions)
      );
    }
    if(!combinaisons.length){
      bloc.appendChild(el("p",{ class:"calc-muette",
        text:"Cette équipe ne permet aucune compétence combinée : elles "
          + "dépendent de l'arme équipée de chaque héros." }));
    }
    return bloc;
  }

  /* Le bloc complet. Il porte SON etat d'edition — la rotation en cours et
     celle enregistree — et ne remonte rien tant que le membre n'a pas
     enregistre. Meme frontiere que l'essai d'enchantements du calculateur, qui
     ne touche jamais le build enregistre.

     Pas d'enregistrement automatique : chaque appui declencherait un `upsert`
     Supabase, et une rotation a moitie composee partirait dans le nuage. */
  function blocRotation(equipe, options){
    const reglages = options || {};
    const modifiable = reglages.modifiable === true;
    const heroes = (equipe && equipe.heroes) || [];
    const competences = (typeof window !== "undefined"
      && window.SEVEN_DS_WIKI_COMPETENCES) || {};
    const catalogueCombinaisons = (typeof window !== "undefined"
      && window.SEVEN_DS_ULTIMES_COMBINES) || [];
    /* Ce que chaque competence verse dans la jauge de releve. Absent, la
       rotation s'affiche entiere et cesse seulement de placer les releves —
       jamais une page en moins pour un catalogue en moins. */
    const jaugesReleve = (typeof window !== "undefined"
      && window.SEVEN_DS_JAUGES_RELEVE) || {};

    let enregistree = normaliserRotation((equipe && equipe.rotation) || []);
    let courante = enregistree.slice();
    /* La palette est repliee des qu'il y a une rotation a lire : c'est elle
       qui fait la hauteur du bloc — une ligne par heros, plus les
       combinaisons. Ouverte tant que la rotation est vide, sans quoi le
       membre ouvrirait un bloc qui ne propose rien. */
    let paletteOuverte = enregistree.length === 0;

    const bloc = el("div",{ class:"rota-corps" });

    const actions = {
      ajouter:etape => { courante = ajouterEtape(courante, etape); dessiner(); },
      retirerUne:rang => { courante = retirerUne(courante, rang); dessiner(); },
      retirerLaCase:rang => {
        courante = retirerLaCase(courante, rang);
        dessiner();
      },
      deplacer:(de, vers) => {
        courante = deplacerCase(courante, de, vers);
        dessiner();
      }
    };

    function dessiner(){
      bloc.innerHTML = "";
      const items = casesDeLaRotation(
        courante, heroes, competences, jaugesReleve
      );
      bloc.appendChild(items.length
        ? suiteDesCases(items, modifiable ? actions : null)
        : el("p",{ class:"calc-muette",
            text:modifiable
              ? "Tape une compétence ci-dessous pour commencer."
              : "Aucune rotation n'a encore été posée pour cette équipe." }));
      if(!modifiable) return;

      const differe = JSON.stringify(courante) !== JSON.stringify(enregistree);
      const barre = el("div",{ class:"rota-barre" });
      const enregistrer = el("button",{
        class:"btn", type:"button", text:"Enregistrer la rotation",
        onclick:()=>{
          enregistrer.disabled = true;
          Promise.resolve(reglages.surEnregistrement(courante.slice()))
            .then(()=>{ enregistree = courante.slice(); dessiner(); })
            .catch(()=>{ dessiner(); });
        }
      });
      if(!differe) enregistrer.disabled = true;
      barre.appendChild(enregistrer);
      if(differe){
        barre.appendChild(el("button",{
          class:"btn btn-ghost", type:"button", text:"Annuler",
          onclick:()=>{ courante = enregistree.slice(); dessiner(); }
        }));
      }
      /* TOUT EFFACER, pour reprendre une rotation de zero sans vider case par
         case. Sans confirmation : tant que le membre n'a pas enregistre,
         « Annuler » ramene la rotation telle qu'elle etait. */
      if(courante.length){
        barre.appendChild(el("button",{
          class:"btn btn-ghost", type:"button", text:"Tout effacer",
          title:"Retirer toutes les cases de la rotation",
          onclick:()=>{ courante = []; dessiner(); }
        }));
      }
      barre.appendChild(el("span",{ class:"calc-muette",
        text:courante.length + " / " + PLAFOND_ROTATION + " appuis" }));
      bloc.appendChild(barre);

      /* LA PALETTE EN DERNIER, ET REPLIABLE.

         Elle occupait le haut du bloc et repoussait « Enregistrer » sous un
         mur d'icones : sur un telephone, le bouton qui valide le travail
         etait le plus loin du doigt. Les commandes viennent maintenant juste
         apres la rotation, et la reserve d'icones apres elles. */
      bloc.appendChild(el("button",{
        class:"btn btn-ghost rota-bascule", type:"button",
        text:(paletteOuverte ? "▾ " : "▸ ") + "Ajouter une compétence",
        "aria-expanded":paletteOuverte ? "true" : "false",
        onclick:()=>{ paletteOuverte = !paletteOuverte; dessiner(); }
      }));
      if(paletteOuverte){
        bloc.appendChild(paletteDesCompetences(
          paletteDeLEquipe(heroes, competences),
          combinaisonsDeLEquipe(heroes, competences, catalogueCombinaisons),
          actions
        ));
      }
    }

    dessiner();
    return bloc;
  }

export { blocRotation };
