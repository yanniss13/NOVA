/* Le bloc de statistiques d'un heros, tel qu'il apparait dans les fiches.

   Onze declarations sur douze sont privees : seul `heroStatsSection` sort.
   Le module traduit les termes rendus par metier/stats-calcul.js en lignes
   lisibles — provenance, libelle, valeur — et n'en calcule aucun.

   Partage par la fiche du heros, le detail du roster, le detail d'equipe et
   le rapport de boss : c'est ce qui lui vaut son propre module. */

import { el } from "../noyau/dom.js";
import { renderBonus } from "./elements.js";
import { ARMOR_LABELS, JEWEL_LABELS, WEAPON_ENUM } from "../noyau/constantes.js";

import {
  BUILD_STAT_FAMILY_LABELS,
  formatBuildStatValue,
  gearTermLabel,
  mainRateValueText,
  statTermsDetails,
  weaponTermLabel
} from "./stats-affichage.js";
import { calculateHeroStats, groupBuildStatResults } from "../metier/stats-calcul.js";

  const HERO_PRIMARY_STATS = [
    ["B_MaxHp", "PV"],
    ["B_Atk", "ATK"],
    ["B_Def", "DEF"]
  ];
  function heroStatsTitle(result){
    if(!result || result.status === "incomplete"){
      return "Statistiques du héros — configuration à compléter";
    }
    if(result.status === "partial"){
      return "Statistiques du héros — calcul partiel";
    }
    if(result.status !== "valid"){
      return "Statistiques du héros — indisponibles";
    }
    return "Statistiques du héros — borne inférieure";
  }
  function heroStatsGroups(result){
    const primary = new Set(HERO_PRIMARY_STATS.map(item => item[0]));
    return groupBuildStatResults(result).map(group => ({
      family:group.family,
      stats:group.stats.filter(stat => !primary.has(stat.stat))
    })).filter(group => group.stats.length);
  }
  function formatHeroStatTotal(value, unit){
    const numeric = unit === "ten-thousandths"
      ? Number(value) / 100 : Number(value);
    return new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits:2
    }).format(numeric) + (unit === "ten-thousandths" ? " %" : "");
  }

  function heroTermOriginLabel(term){
    const source = (term && term.source) || {};
    if(source.domain === "character") return "Base du personnage";
    if(source.domain === "mastery"){
      if(source.component === "common-mastery") return "Maîtrise commune";
      if(source.component === "reserve-weapon-mastery"){
        return "Maîtrises de réserve";
      }
      const meta = WEAPON_ENUM[source.weaponType];
      return "Maîtrise "+((meta && meta.label) || source.weaponType || "");
    }
    if(source.domain === "potential") return "Potentiel P"+source.tier;
    if(source.domain === "set") return "Bonus d’ensemble";
    if(source.domain === "armor" || source.domain === "jewel"
      || source.domain === "engraving"){
      return "Équipement";
    }
    return null;
  }
  function heroTermLabel(term){
    const source = term.source || {};
    if(source.component === "final-ceil"
      || source.component === "final-rounding"){
      return "Arrondi du jeu";
    }
    if(term.operation === "multiply"){
      if(source.application === "hero-main-rate"){
        return heroTermOriginLabel(term) || "Application du taux";
      }
      return source.component === "overlimit"
        ? "Outrepassement" : "Application du taux";
    }
    const origin = heroTermOriginLabel(term);
    if(origin) return origin;
    if(source.domain === "weapon") return weaponTermLabel(term);
    if(source.domain === "secondary-weapon"){
      return (source.weaponType || "Arme")
        +" secondaire : "
        +formatHeroStatTotal(source.originalValue, "flat")
        +" ATK × "
        +formatHeroStatTotal(source.transferRate, "ten-thousandths")
        +" =";
    }
    return gearTermLabel(term);
  }
  function heroTermProvenance(term){
    const source = term.source || {};
    const component = source.component === "final-ceil"
      || source.component === "final-rounding"
      ? "arrondi au supérieur"
      : (source.component || "contribution");
    const parts = [
      "Source : "+(source.domain || "inconnue"),
      component,
      "unité "+(term.unit === "flat" ? "points" : "dix-millièmes")
    ];
    if(source.field) parts.push("champ "+source.field);
    if(source.weaponType) parts.push("arme "+source.weaponType);
    if(Number.isInteger(source.level)) parts.push("nœud "+source.level);
    if(source.kind) parts.push(source.kind);
    if(source.slot) parts.push("emplacement "+source.slot);
    if(source.id) parts.push(source.id);
    if(source.originalStat) parts.push("code original "+source.originalStat);
    if(term.operation === "add") parts.push("seau "+term.bucket);
    return parts.join(" · ");
  }

  function heroTermValue(term, group){
    if(term.operation !== "multiply"){
      return formatBuildStatValue(term.value, term.unit)
        +(term.unit === "flat" ? " points" : "");
    }
    if(group.mainRate) return mainRateValueText(term.value);
    const presumed = term.confidence === "presumed"
      || (term.source && term.source.component === "overlimit");
    return "×"+new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits:4
    }).format(1 + Number(term.value) / 10000)
      +(presumed ? " — base présumée" : "");
  }
  function heroStatDetails(stat){
    return statTermsDetails(stat, {
      termLabel:heroTermLabel,
      termValue:heroTermValue,
      termProvenance:heroTermProvenance,
      termEmphasis:term => term.operation === "multiply"
        ? "weapon-stat-term-overlimit" : ""
    });
  }
  function heroPassiveLabel(fact){
    if(fact.source === "weapon:passive") return "Arme";
    return ARMOR_LABELS[fact.slot] || JEWEL_LABELS[fact.slot] || fact.slot;
  }
  function heroPassivesSection(passives){
    if(!Array.isArray(passives) || !passives.length) return null;
    const section = el("section",{class:"hero-passives"});
    section.appendChild(el("h4",{
      class:"weapon-stats-family-title",
      text:"Passifs non inclus dans le calcul"
    }));
    passives.forEach(fact => {
      let state = "Niveau du passif à renseigner";
      if(fact.status === "valid"){
        state = "Niveau "+fact.level+" / "+fact.maxLevel;
      }else if(fact.status === "incompatible"){
        state = "Niveau du passif invalide";
      }
      const item = el("article",{class:"hero-passive"},[
        el("div",{class:"hero-passive-head"},[
          el("strong",{text:heroPassiveLabel(fact)}),
          el("span",{text:state})
        ])
      ]);
      if(fact.status === "valid" && fact.text){
        item.appendChild(el("p",{
          class:"hero-passive-text",
          html:renderBonus(fact.text)
        }));
      }
      section.appendChild(item);
    });
    return section;
  }
  function heroStatsSection(hero){
    const result = calculateHeroStats(hero);
    const section = el("section",{
      class:"hero-stats",
      dataset:{status:result.status}
    });
    section.appendChild(el("h3",{
      class:"weapon-stats-title",
      text:heroStatsTitle(result)
    }));
    const hasNumericResult =
      result.status === "valid" || result.status === "partial";
    if(!hasNumericResult){
      const details = result.missing.length
        ? " À compléter : "+result.missing.join(", ")+"."
        : "";
      section.appendChild(el("p",{
        class:"weapon-stats-state",
        text:(result.status === "incomplete"
          ? "Équipe et configure les neuf pièces pour obtenir une valeur fiable."
          : "Les données de cette configuration ne peuvent pas être calculées.")
          +details
      }));
      return section;
    }

    section.appendChild(el("span",{
      class:"hero-stats-assumption",
      text:"Base d’application présumée"
    }));
    const grouped = groupBuildStatResults(result);
    const statsByCode = new Map(
      grouped.flatMap(group => group.stats).map(stat => [stat.stat,stat])
    );
    const primary = el("div",{class:"hero-stats-primary"});
    HERO_PRIMARY_STATS.forEach(([code, label]) => {
      const stat = statsByCode.get(code);
      const partial = (result.partialStats || []).includes(stat.stat);
      const card = el("article",{
        class:"hero-stat-card",
        dataset:{stat:code}
      },[
        el("span",{class:"hero-stat-card-label",text:label}),
        el("strong",{
          class:"hero-stat-card-value",
          text:formatHeroStatTotal(stat.value, stat.unit)
        }),
        el("small",{
          class:"hero-stat-card-bound",
          text:partial
            ? "calcul incomplet — arme secondaire manquante"
            : "borne inférieure"
        })
      ]);
      card.appendChild(heroStatDetails(stat));
      primary.appendChild(card);
    });
    section.appendChild(primary);

    /* PV, ATK et DEF restent visibles ; tout le reste se replie.

       La modale d'equipe affiche jusqu'a quatre heros cote a cote, et ce
       bloc pouvait faire une trentaine de lignes chacun — les trois chiffres
       que le membre vient chercher se retrouvaient noyes. Le detail reste a
       un clic pour qui le veut.

       Un `details` natif plutot qu'un repli maison : il est atteignable au
       clavier, annonce son etat par un lecteur d'ecran, et la recherche du
       navigateur y ouvre le contenu toute seule. */
    const secondaires = heroStatsGroups(result);
    const passives = heroPassivesSection(result.facts.passives);
    const compte = secondaires.reduce(
      (total, group) => total + group.stats.length,
      0
    );
    /* Rien a replier : pas de bouton qui n'ouvre sur rien. */
    if(!compte && !passives) return section;

    const reste = el("details",{class:"hero-stats-more"});
    reste.appendChild(el("summary",{
      class:"hero-stats-more-summary",
      text:compte ? "Toutes les statistiques ("+compte+")" : "Passifs"
    }));

    secondaires.forEach(group => {
      const family = el("section",{class:"weapon-stats-family"});
      family.appendChild(el("h4",{
        class:"weapon-stats-family-title",
        text:BUILD_STAT_FAMILY_LABELS[group.family] || group.family
      }));
      group.stats.forEach(stat => {
        const node = el("div",{class:"weapon-stat"},[
          el("div",{class:"weapon-stat-head"},[
            el("span",{text:stat.label}),
            el("span",{
              class:"weapon-stat-total",
              dataset:{unit:stat.unit},
              text:formatHeroStatTotal(stat.value, stat.unit)
            })
          ])
        ]);
        node.appendChild(heroStatDetails(stat));
        family.appendChild(node);
      });
      reste.appendChild(family);
    });

    if(passives) reste.appendChild(passives);
    section.appendChild(reste);
    return section;
  }

export {
  heroStatsSection
};
