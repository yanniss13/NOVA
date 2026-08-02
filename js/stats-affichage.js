/* Rendu des termes de statistiques : regroupement, libelles et notes de bloc.

   Ce module ne calcule rien. Il met en forme des termes deja calcules, pour
   la fiche du heros comme pour le panneau d'arme.

   Sept declarations sur onze restent privees : le regroupement par cle, les
   noeuds de rendu et les notes de seau n'ont aucun sens hors d'ici. */

import { el } from "./dom.js";

  function formatBuildStatValue(value, unit){
    if(unit !== "flat" && unit !== "ten-thousandths"){
      throw new Error("BUILD_STAT_UNIT_INVALID");
    }
    const numeric = Number(value);
    if(!Number.isFinite(numeric)) throw new Error("BUILD_STAT_VALUE_INVALID");
    const displayed = unit === "ten-thousandths" ? numeric / 100 : numeric;
    const prefix = displayed >= 0 ? "+" : "";
    return prefix + new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits:2
    }).format(displayed) + (unit === "ten-thousandths" ? " %" : "");
  }

  /* Dictionnaire partagé par les provenances et par le pied de bloc des seaux
     ciblés : un même seau doit porter le même libellé partout, faute de quoi
     la note de pied de bloc et la ligne d'un terme additif se contrediraient. */
  const BUILD_BUCKET_LABELS = {
    "weapon-native":"statistiques natives de l’arme",
    "weapon-enchantment":"enchantements de l’arme"
  };
  /* Deux termes ne sont regroupés que s'ils produiraient exactement la même
     ligne. `appliesTo` fait partie de la clé parce que la contribution d'un
     multiplicateur vaut base(appliesTo) × valeur : sommer deux taux visant des
     seaux différents afficherait un total appliqué à une base qui n'existe
     pas. L'emphase en fait partie parce qu'elle change la ligne rendue. */
  const STAT_TERM_KEY_SEPARATOR = "\u0001";
  function statTermGroupKey(term, termLabel, termEmphasis){
    return [
      termLabel(term) || "Autre",
      term.operation,
      term.unit,
      term.operation === "multiply"
        ? [...(term.appliesTo || [])].sort().join(",")
        : "",
      termEmphasis(term) || "",
      /* `mainRate` change la notation ET l'emplacement du groupe : un taux
         principal et un multiplicateur ordinaire ne doivent jamais fusionner,
         même si tout le reste coïncide. */
      ((term.source || {}).application === "hero-main-rate") ? "1" : "0"
    ].join(STAT_TERM_KEY_SEPARATOR);
  }
  function statTermGroups(stat, options){
    const settings = options || {};
    const termLabel = settings.termLabel;
    const termEmphasis = settings.termEmphasis || (() => "");
    const groups = [];
    const index = new Map();
    ((stat && stat.terms) || []).forEach(term => {
      const key = statTermGroupKey(term, termLabel, termEmphasis);
      let group = index.get(key);
      if(!group){
        const source = term.source || {};
        group = {
          key,
          label:termLabel(term) || "Autre",
          operation:term.operation,
          unit:term.unit,
          appliesTo:term.operation === "multiply"
            ? [...(term.appliesTo || [])].sort() : [],
          emphasis:termEmphasis(term) || "",
          mainRate:source.application === "hero-main-rate",
          value:0,
          terms:[]
        };
        index.set(key, group);
        groups.push(group);
      }
      group.value += Number(term.value) || 0;
      group.terms.push(term);
    });
    return groups;
  }
  /* Les taux principaux s'additionnent : les écrire ×1,03 laisserait croire à
     un produit composé. Trois nœuds à 3 % font +9 %, pas +9,27 %. */
  function mainRateValueText(value){
    return formatBuildStatValue(value, "ten-thousandths");
  }
  function statTermNode(term, group, termValue, termProvenance){
    return el("div",{
      class:"weapon-stat-term",
      dataset:{
        termId:term.id,
        operation:term.operation,
        unit:term.unit,
        buckets:term.operation === "multiply"
          ? term.appliesTo.join(",") : term.bucket
      }
    },[
      el("div",{class:"weapon-stat-term-value"},[
        el("span",{text:group.label}),
        el("span",{
          class:group.emphasis,
          text:termValue(term, group)
        })
      ]),
      el("small",{
        class:"weapon-stat-provenance",
        text:termProvenance(term)
      })
    ]);
  }
  /* Le total d'un groupe n'est affiché que pour les taux principaux et les
     additifs, dont la somme a un sens. Un groupe de multiplicateurs non
     principaux n'existe pas en pratique : chacun porte un libellé distinct. */
  function statGroupTotalText(group){
    if(group.operation === "multiply"){
      return group.mainRate ? mainRateValueText(group.value) : "";
    }
    return formatBuildStatValue(group.value, group.unit)
      +(group.unit === "flat" ? " points" : "");
  }
  function statGroupNode(group, termValue, termProvenance){
    if(group.terms.length === 1){
      return statTermNode(group.terms[0], group, termValue, termProvenance);
    }
    const node = el("details",{class:"stat-term-group"},[
      el("summary",{},[
        el("span",{
          text:group.label+" · "+group.terms.length+" apports"
        }),
        el("span",{class:group.emphasis, text:statGroupTotalText(group)})
      ])
    ]);
    group.terms.forEach(term => {
      node.appendChild(statTermNode(term, group, termValue, termProvenance));
    });
    return node;
  }
  function statBucketNotes(groups){
    /* Une même statistique porte plusieurs bases : les taux principaux visent
       tous les seaux fixes, l'outrepassement les seuls seaux natifs de l'arme.
       Une note unique afficherait la mauvaise base pour l'un des deux.
       La note dit seulement où le taux s'applique : la mention « base
       présumée » vit sur la ligne ou le bloc concerné, jamais deux fois. */
    const seen = new Set();
    const notes = [];
    groups.forEach(group => {
      if(group.operation !== "multiply") return;
      const key = group.appliesTo.join(",");
      if(!key || seen.has(key)) return;
      seen.add(key);
      notes.push(el("small",{
        class:"stat-term-buckets",
        text:"Appliqué à : "+key.split(",")
          .map(bucket => BUILD_BUCKET_LABELS[bucket] || bucket)
          .join(", ")
      }));
    });
    return notes;
  }
  function statTermsDetails(stat, options){
    const settings = options || {};
    const termValue = settings.termValue;
    const termProvenance = settings.termProvenance;
    const termEmphasis = settings.termEmphasis || (() => "");
    const details = el("details",{class:"weapon-stat-details"},[
      el("summary",{text:"Détail du calcul"})
    ]);
    const groups = statTermGroups(stat, {
      termLabel:settings.termLabel,
      termEmphasis
    });
    /* Un bloc « Taux principaux » par base visée. Additionner des taux qui ne
       visent pas les mêmes seaux donnerait un total appliqué à une base qui
       n'existe pas — c'est précisément ce que la clé de groupe interdit, et le
       rendu ne doit pas le réintroduire. */
    const mainRateBlocks = new Map();
    groups.forEach(group => {
      if(!group.mainRate) return;
      const key = group.appliesTo.join(",");
      if(!mainRateBlocks.has(key)) mainRateBlocks.set(key, []);
      mainRateBlocks.get(key).push(group);
    });
    const renderedBlocks = new Set();
    groups.forEach(group => {
      if(!group.mainRate){
        details.appendChild(
          statGroupNode(group, termValue, termProvenance)
        );
        return;
      }
      const key = group.appliesTo.join(",");
      if(renderedBlocks.has(key)) return;
      renderedBlocks.add(key);
      const block = mainRateBlocks.get(key);
      const total = block.reduce((sum, item) => sum + item.value, 0);
      const presumed = block.some(item =>
        item.terms.some(term => term.confidence === "presumed")
      );
      const parent = el("details",{class:"stat-term-group"},[
        el("summary",{},[
          el("span",{
            text:"Taux principaux"+(presumed ? " — base présumée" : "")
          }),
          el("span",{text:mainRateValueText(total)})
        ])
      ]);
      block.forEach(item => {
        parent.appendChild(statGroupNode(item, termValue, termProvenance));
      });
      details.appendChild(parent);
    });
    statBucketNotes(groups).forEach(note => details.appendChild(note));
    return details;
  }

  const BUILD_STAT_FAMILY_LABELS = {
    main:"PV · ATK · DEF",
    additional:"Statistiques supplémentaires",
    damage:"Modificateurs de dégâts",
    special:"Statistiques spéciales",
    elemental:"Statistiques élémentaires"
  };

  function buildStatsTitle(subject, result){
    const missing = Array.isArray(result.uncovered) ? result.uncovered : [];
    if(missing.includes(subject.passiveKey)){
      return "Apport " + subject.of + " hors passif — borne inférieure";
    }
    if(missing.length) return "Apport " + subject.of + " — borne inférieure";
    return "Apport " + subject.of + " — calcul partiel";
  }

export {
  buildStatsTitle,  BUILD_STAT_FAMILY_LABELS,  BUILD_BUCKET_LABELS,
  formatBuildStatValue,
  mainRateValueText,
  statTermsDetails
};
