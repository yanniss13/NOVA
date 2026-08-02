/* L'editeur de configuration d'une piece d'equipement : niveau, renforcement,
   enchantements et passif graves.

   Meme forme que js/vues/editeur-arme.js, dont il partage les aides de rendu
   `weaponConfigField` et `weaponConfigOption`.

   `gearConfigEditorState` sort en lecture seule : toutes les affectations
   vivent ici, l'exterieur ne fait que consulter l'etat courant. C'est ce que
   permet une liaison `let` exportee — lisible, jamais reaffectable ailleurs. */

import { $, el, numericKeyboardInputProps } from "../noyau/dom.js";
import { BUILD_GEAR, BUILD_GEAR_SETS, gearEnchantmentChoiceStatus } from "../metier/build-config.js";
import { BUILD_STATS } from "../noyau/constantes.js";
import { isInteger, jsonCopy, owns } from "../noyau/outils.js";
import { ModalStack } from "./modal-stack.js";

import { renderBonus } from "./elements.js";
import { weaponConfigField, weaponConfigOption } from "./editeur-arme.js";
import {
  BUILD_STAT_FAMILY_LABELS,
  buildStatsTitle,
  formatBuildStatValue,
  gearTermLabel,
  statTermsDetails
} from "./stats-affichage.js";
import {
  calculateGearStats,
  gearDomainOf,
  groupBuildStatResults
} from "../metier/stats-calcul.js";
import {
  GEAR_PASSIVE_MAX_LEVEL,
  buildGearDefinition,
  gearConfigStatus,
  gearEnchantmentLength
} from "../metier/build-config.js";

  function emptyGearConfig(file){
    const definition = buildGearDefinition(file);
    if(!definition) return null;
    return {
      version:1,
      level:definition.qualityMin,
      reinforce:0,
      enchantments:Array.from({
        length:gearEnchantmentLength(definition)
      }, ()=>null),
      passiveLevel:null
    };
  }

  let gearConfigEditorState = null;

  function gearStatsStatusMessage(status){
    if(status === "unavailable"){
      return "Les données chiffrées de cette pièce ne sont pas disponibles.";
    }
    if(status === "missing"){
      return "Configuration à compléter pour calculer l’apport de cette pièce.";
    }
    if(status === "incomplete"){
      return "Complète les champs requis pour afficher l’apport de cette pièce.";
    }
    return "Cette configuration n’est pas compatible avec les données de la pièce.";
  }


  function gearTermProvenance(term){
    const source = term.source || {};
    const domains = {
      armor:"armure",
      engraving:"gravure",
      jewel:"bijou",
      set:"ensemble"
    };
    const parts = [
      "Source : "+(domains[source.domain] || source.domain || "inconnue"),
      gearTermLabel(term),
      "opération addition",
      "unité "+(term.unit === "flat" ? "points" : "dix-millièmes")
    ];
    if(source.id) parts.push(source.id);
    if(source.slot) parts.push("emplacement "+source.slot);
    if(term.bucket) parts.push("seau "+term.bucket);
    return parts.join(" · ");
  }

  function gearStatsSection(file, config, slotKey){
    const section = el("section",{class:"weapon-stats"});
    const result = calculateGearStats(file, config, slotKey);
    const engraving = gearDomainOf(slotKey) === "engraving";
    section.appendChild(el("h3",{
      class:"weapon-stats-title",
      text:buildStatsTitle(
        engraving
          ? {of:"de la gravure",passiveKey:"engraving:passive"}
          : {of:"de l’équipement",passiveKey:"armor:passive"},
        result
      )
    }));
    const covered = result.status === "valid"
      && Array.isArray(result.coverage)
      && result.coverage.includes(gearDomainOf(slotKey));
    if(!covered){
      section.appendChild(el("p",{
        class:"weapon-stats-state",
        text:gearStatsStatusMessage(result.status)
      }));
      return section;
    }

    groupBuildStatResults(result).forEach(group => {
      const family = el("section",{class:"weapon-stats-family"});
      family.appendChild(el("h4",{
        class:"weapon-stats-family-title",
        text:BUILD_STAT_FAMILY_LABELS[group.family] || group.family
      }));
      group.stats.forEach(stat => {
        const statNode = el("div",{class:"weapon-stat"});
        statNode.appendChild(el("div",{class:"weapon-stat-head"},[
          el("span",{text:stat.label}),
          el("span",{
            class:"weapon-stat-total",
            dataset:{unit:stat.unit},
            text:formatBuildStatValue(stat.value, stat.unit)
              +(stat.unit === "flat" ? " points" : "")
          })
        ]));
        const details = statTermsDetails(stat, {
          termLabel:gearTermLabel,
          termValue:term => formatBuildStatValue(term.value, term.unit)
            +(term.unit === "flat" ? " points" : ""),
          termProvenance:gearTermProvenance
        });
        statNode.appendChild(details);
        family.appendChild(statNode);
      });
      section.appendChild(family);
    });
    return section;
  }

  function updateGearConfigPreview(){
    const state = gearConfigEditorState;
    if(!state) return;
    const preview = $("#gearConfigPreview");
    preview.innerHTML = "";
    preview.appendChild(gearStatsSection(
      state.context.file,
      state.draft,
      state.context.slotKey
    ));
    $("#gearConfigError").textContent = state.validationAttempted
      && gearConfigStatus(state.context.file, state.draft) !== "valid"
      ? "Vérifie les champs signalés avant de valider."
      : "";
  }

  function renderGearConfigEnchantments(body, definition, draft){
    const container = el("div",{class:"weapon-enchantments"},[
      el("span",{class:"weapon-enchantment-title",text:"Options aléatoires"})
    ]);
    const options = (definition.randomOptions
      && Array.isArray(definition.randomOptions.stats))
      ? definition.randomOptions.stats : [];
    draft.enchantments.forEach((choice, index) => {
      const used = new Set(draft.enchantments
        .filter((entry, position) => entry && position !== index && entry.stat)
        .map(entry => entry.stat));
      const available = options.filter(option => !used.has(option.stat));
      const box = el("div",{
        class:"weapon-enchantment",
        dataset:{gearSlot:String(index)}
      });
      box.appendChild(el("span",{
        class:"weapon-enchantment-title",
        text:"Option "+(index + 1)
      }));
      const select = el("select",{class:"gear-config-enchantment-stat"});
      select.appendChild(weaponConfigOption("","Aucune option"));
      available.forEach(option => {
        const metadata = BUILD_STATS.statLabels[option.stat];
        select.appendChild(weaponConfigOption(
          option.stat,
          metadata ? metadata.fr : option.stat
        ));
      });
      select.value = choice ? choice.stat : "";
      select.addEventListener("change", event => {
        const option = options.find(item => item.stat === event.target.value);
        draft.enchantments[index] = option ? {
          slot:index,
          stat:option.stat,
          value:option.min
        } : null;
        renderGearConfigEditor();
      });
      box.appendChild(weaponConfigField("Statistique",select));
      if(choice){
        const option = options.find(item => item.stat === choice.stat);
        const value = el("input",numericKeyboardInputProps({
          class:"gear-config-enchantment-value",
          step:"1",
          min:option ? String(option.min) : "0",
          max:option ? String(option.max) : "0",
          value:String(choice.value)
        }));
        value.addEventListener("input", event => {
          choice.value = event.target.value === ""
            ? null
            : Math.trunc(Number(event.target.value));
          updateGearConfigPreview();
        });
        box.appendChild(weaponConfigField(
          "Valeur",
          value,
          option ? "De "+option.min+" à "+option.max+"." : ""
        ));
      }
      container.appendChild(box);
    });
    if(!draft.enchantments.length){
      container.appendChild(el("p",{
        class:"weapon-config-hint",
        text:"Cette pièce ne possède aucun emplacement d’option aléatoire."
      }));
    }
    body.appendChild(container);
  }

  function renderGearConfigPassive(body, definition, draft){
    if(!Array.isArray(definition.passiveLevels)
      || !definition.passiveLevels.length){
      return;
    }
    const container = el("div",{class:"gear-config-passive"},[
      el("span",{class:"weapon-enchantment-title",text:"Passif"})
    ]);
    const select = el("select",{class:"gear-config-passive-level"});
    select.appendChild(weaponConfigOption("","À renseigner"));
    definition.passiveLevels.forEach(item => {
      select.appendChild(weaponConfigOption(item.level,String(item.level)));
    });
    select.value = isInteger(draft.passiveLevel)
      && draft.passiveLevel >= 1
      && draft.passiveLevel <= GEAR_PASSIVE_MAX_LEVEL
      ? String(draft.passiveLevel) : "";
    const description = el("p",{class:"hero-passive-text weapon-config-hint"});
    const updateDescription = () => {
      const selected = definition.passiveLevels.find(
        item => item.level === draft.passiveLevel
      );
      description.innerHTML = selected
        ? renderBonus(selected.textFr || "")
        : "Niveau du passif à renseigner";
    };
    select.addEventListener("change", event => {
      draft.passiveLevel = event.target.value === ""
        ? null : Number(event.target.value);
      updateDescription();
      updateGearConfigPreview();
    });
    container.appendChild(weaponConfigField(
      "Niveau du passif",
      select,
      "Information enregistrée séparément ; elle ne modifie pas les chiffres."
    ));
    updateDescription();
    container.appendChild(description);
    body.appendChild(container);
  }

  function renderGearConfigEditor(){
    const state = gearConfigEditorState;
    if(!state) return;
    const body = $("#gearConfigBody");
    body.innerHTML = "";
    const definition = buildGearDefinition(state.context.file);
    if(!definition || !state.draft){
      body.appendChild(el("p",{
        class:"weapon-stats-state",
        text:"Les données chiffrées de cette pièce ne sont pas disponibles."
      }));
      updateGearConfigPreview();
      return;
    }
    const draft = state.draft;
    const level = el("input",numericKeyboardInputProps({
      class:"gear-config-level",
      step:"1",
      min:String(definition.qualityMin),
      max:String(definition.qualityMax),
      value:String(draft.level)
    }));
    level.addEventListener("input", event => {
      draft.level = event.target.value === ""
        ? null
        : Math.trunc(Number(event.target.value));
      updateGearConfigPreview();
    });
    body.appendChild(weaponConfigField(
      "Niveau de qualité",
      level,
      "De "+definition.qualityMin+" à "+definition.qualityMax+"."
    ));

    const reinforce = el("select",{class:"gear-config-reinforce"});
    for(let value = 0; value <= definition.reinforceMax; value += 1){
      reinforce.appendChild(weaponConfigOption(value,"+"+value));
    }
    reinforce.value = String(draft.reinforce);
    reinforce.addEventListener("change", event => {
      draft.reinforce = Number(event.target.value);
      updateGearConfigPreview();
    });
    body.appendChild(weaponConfigField("Renforcement",reinforce));
    renderGearConfigEnchantments(body, definition, draft);
    renderGearConfigPassive(body, definition, draft);
    updateGearConfigPreview();
  }

  function openGearConfigEditor(context, restoreFocus){
    const initial = context.config == null
      ? emptyGearConfig(context.file)
      : jsonCopy(context.config);
    if(initial && initial.version === 1 && !owns(initial, "passiveLevel")){
      initial.passiveLevel = null;
    }
    gearConfigEditorState = {
      context,
      draft:initial,
      validationAttempted:false
    };
    $("#gearConfigTitle").textContent = "Configurer — "+context.label;
    renderGearConfigEditor();
    ModalStack.open(
      $("#gearConfigOverlay"),
      ".gear-config-level",
      closeGearConfigEditor,
      restoreFocus
    );
  }

  function closeGearConfigEditor(){
    ModalStack.close($("#gearConfigOverlay"));
    gearConfigEditorState = null;
  }

  /* Le catalogue, la sauvegarde et le cablage des boutons vivaient dans
     app.js : ils y avaient ete oublies quand l'editeur en est sorti.
     editeur-arme.js branche ses propres boutons de la meme facon. */
  function buildGearCatalog(){
    return BUILD_GEAR;
  }
  /* PRÉSUMÉ, NON VÉRIFIÉ :
   * le gain par niveau d'une pièce part de la borne basse de son segment.
   *
   * Vérification dans le jeu : relever la même statistique d'une même armure
   * à qualityMin, juste avant, au niveau et juste après la première borne
   * interne, puis comparer les reconstructions "segment-lower-bound" et
   * "quality-min". Si la mesure contredit ce choix, remplacer uniquement la
   * valeur ci-dessous. Aucune autre partie du moteur ne connaît l'hypothèse. */
  /* Une arme ne porte qu'une seule perle : tous les emplacements renseignés
     doivent partager le même palier et le même élément. Sans cette contrainte,
     un état absurde deviendrait « valide ». */
  /* Le jeu interdit deux fois la même stat sur une perle. Les emplacements
     encore vides ne comptent pas : sinon toute saisie en cours serait refusée. */

  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * l’outrepassement multiplie la statistique principale native de l’arme
   * avant les enchantements. Le fait qu’il ne touche ni les sous-statistiques
   * ni le passif est confirmé par le propriétaire ; seule la base précise de
   * la statistique principale reste présumée.
   *
   * Vérification dans le jeu :
   * relever l’ATK à outrepassement 0 puis 1 sur une arme enchantée.
   * Si le gain de 5 % inclut les enchantements, remplacer uniquement
   * "native-before-enchantments" par "native-and-enchantments".
   */

  function buildGearSets(){
    return BUILD_GEAR_SETS;
  }

  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * les 30 % d'ATK plate des deux armes secondaires sont ajoutés avant les
   * taux principaux du héros. Protocole : comparer sur Merlin l'ATK affichée
   * avec les deux armes secondaires configurées, puis sans l'une d'elles. Si
   * l'écart réel n'est pas lui-même affecté par les taux principaux, changer
   * uniquement ce mode et le branchement de ces seaux.
   */

  function gearConfigFirstInvalidSelector(file, draft){
    const definition = buildGearDefinition(file);
    if(!definition) return ".gear-config-level";
    if(!draft || !isInteger(draft.level)
      || draft.level < definition.qualityMin
      || draft.level > definition.qualityMax){
      return ".gear-config-level";
    }
    if(!isInteger(draft.reinforce)
      || draft.reinforce < 0
      || draft.reinforce > definition.reinforceMax){
      return ".gear-config-reinforce";
    }
    const choices = Array.isArray(draft.enchantments) ? draft.enchantments : [];
    for(let index = 0; index < choices.length; index += 1){
      const status = gearEnchantmentChoiceStatus(definition, choices[index], index);
      if(status !== "valid"){
        const suffix = choices[index] && choices[index].stat ? "value" : "stat";
        return '[data-gear-slot="'+index+'"] .gear-config-enchantment-'+suffix;
      }
    }
    return ".gear-config-level";
  }

  function saveGearConfigEditor(){
    const state = gearConfigEditorState;
    if(!state) return;
    if(gearConfigStatus(state.context.file, state.draft) !== "valid"){
      state.validationAttempted = true;
      renderGearConfigEditor();
      const invalid = $("#gearConfigOverlay").querySelector(
        gearConfigFirstInvalidSelector(state.context.file, state.draft)
      );
      if(invalid){
        invalid.setAttribute("aria-invalid","true");
        invalid.focus();
      }
      return;
    }
    state.context.commit(jsonCopy(state.draft));
    closeGearConfigEditor();
  }

  function resetGearConfigEditor(){
    const state = gearConfigEditorState;
    if(!state) return;
    if(!confirm("Réinitialiser la configuration chiffrée de cette pièce ?")) return;
    state.context.commit(null);
    closeGearConfigEditor();
  }

  $("#gearConfigClose").addEventListener("click", closeGearConfigEditor);
  $("#gearConfigCancel").addEventListener("click", closeGearConfigEditor);
  $("#gearConfigSave").addEventListener("click", saveGearConfigEditor);
  $("#gearConfigReset").addEventListener("click", resetGearConfigEditor);
  $("#gearConfigOverlay").addEventListener("click", event => {
    if(event.target === $("#gearConfigOverlay")) closeGearConfigEditor();
  });

/* Trois declarations sont redevenues privees quand la sauvegarde et le
   cablage sont rentres d'app.js : plus personne dehors n'en a besoin.
   Seule l'ouverture de l'editeur reste publique. */
export { openGearConfigEditor };
